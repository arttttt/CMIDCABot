/**
 * Create wallet use case
 */

import type { TelegramId } from "../models/id/index.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { BlockchainRepository } from "../repositories/BlockchainRepository.js";
import { SecretStoreRepository } from "../repositories/SecretStoreRepository.js";
import type { OperationLockRepository } from "../repositories/OperationLockRepository.js";
import { CreateWalletResult } from "./types.js";
import { logger } from "../../infrastructure/shared/logging/index.js";
import { withRetry } from "../../infrastructure/shared/resilience/index.js";
import { GetWalletInfoByAddressUseCase } from "./GetWalletInfoByAddressUseCase.js";
import { GetWalletInfoByPrivateKeyUseCase } from "./GetWalletInfoByPrivateKeyUseCase.js";
import { WalletCreationLock } from "../constants/WalletCreationLock.js";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export class CreateWalletUseCase {
  constructor(
    private userRepository: UserRepository,
    private blockchainRepository: BlockchainRepository,
    private getWalletInfoByAddressUseCase: GetWalletInfoByAddressUseCase,
    private getWalletInfoByPrivateKeyUseCase: GetWalletInfoByPrivateKeyUseCase,
    private operationLockRepository: OperationLockRepository,
    private secretStore: SecretStoreRepository,
  ) {}

  async execute(telegramId: TelegramId): Promise<CreateWalletResult> {
    logger.info("CreateWallet", "Creating wallet", { telegramId });

    const lockKey = WalletCreationLock.getKey(telegramId);
    const lockAcquired = await this.operationLockRepository.acquire(
      lockKey,
      WalletCreationLock.TTL_MS,
      Date.now(),
    );

    if (!lockAcquired) {
      logger.info("CreateWallet", "Wallet creation already in progress", { telegramId });
      return { type: "operation_in_progress" };
    }

    try {
      await this.userRepository.create(telegramId);

      const user = await this.userRepository.getById(telegramId);

      if (user?.privateKey && user?.walletAddress) {
        logger.info("CreateWallet", "Wallet already exists", { telegramId });
        // Use walletAddress instead of decrypting privateKey
        const wallet = await this.getWalletInfoByAddressUseCase.execute(user.walletAddress);
        return { type: "already_exists", wallet };
      }

      return this.createWalletWithRetry(telegramId);
    } finally {
      await this.operationLockRepository.release(lockKey);
    }
  }

  private async createWalletWithRetry(telegramId: TelegramId): Promise<CreateWalletResult> {
    // Generate keypair ONCE before retry loop - keypair generation is deterministic
    // and should not be repeated on I/O failures
    logger.debug("CreateWallet", "Generating new keypair with mnemonic");
    const keypair = await this.blockchainRepository.generateKeypairFromMnemonic();

    // Cache seedUrl to avoid duplicate storage on retry
    let seedUrl: string | undefined;

    // Retry only I/O operations (secret store + database)
    await withRetry(
      async () => {
        // 1. Store seed phrase only on first attempt
        if (!seedUrl) {
          seedUrl = await this.secretStore.store(keypair.mnemonic, telegramId);
        }

        // 2. Write to database (private key + address)
        await this.userRepository.setWalletData(
          telegramId,
          keypair.privateKeyBase64,
          keypair.address,
        );
      },
      MAX_RETRIES,
      BASE_DELAY_MS,
      () => true, // Retry all errors
    );

    logger.info("CreateWallet", "Wallet created", {
      telegramId,
      address: keypair.address,
    });

    const wallet = await this.getWalletInfoByPrivateKeyUseCase.execute(keypair.privateKeyBase64);

    return { type: "created", wallet, seedUrl: seedUrl! };
  }
}
