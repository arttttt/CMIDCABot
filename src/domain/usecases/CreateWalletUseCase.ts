/**
 * Create wallet use case
 */

import type { TelegramId } from "../models/id/index.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { BlockchainRepository } from "../repositories/BlockchainRepository.js";
import { SecretStoreRepository } from "../repositories/SecretStoreRepository.js";
import { WalletInfoHelper } from "../helpers/WalletInfoHelper.js";
import { CreateWalletResult } from "./types.js";
import { logger } from "../../infrastructure/shared/logging/index.js";
import { withRetry } from "../../infrastructure/shared/resilience/index.js";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export class CreateWalletUseCase {
  constructor(
    private userRepository: UserRepository,
    private blockchainRepository: BlockchainRepository,
    private walletHelper: WalletInfoHelper,
    private secretStore: SecretStoreRepository,
  ) {}

  async execute(telegramId: TelegramId): Promise<CreateWalletResult> {
    logger.info("CreateWallet", "Creating wallet", { telegramId });

    await this.userRepository.create(telegramId);

    if (this.walletHelper.isDevMode()) {
      logger.debug("CreateWallet", "Dev mode - returning shared wallet");
      const wallet = await this.walletHelper.getDevWalletInfo();
      return { type: "dev_mode", wallet };
    }

    const user = await this.userRepository.getById(telegramId);

    if (user?.privateKey && user?.walletAddress) {
      logger.info("CreateWallet", "Wallet already exists", { telegramId });
      // Use walletAddress instead of decrypting privateKey
      const wallet = await this.walletHelper.getWalletInfoByAddress(user.walletAddress, false);
      return { type: "already_exists", wallet };
    }

    return this.createWalletWithRetry(telegramId);
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

    const wallet = await this.walletHelper.getWalletInfo(keypair.privateKeyBase64, false);

    return { type: "created", wallet, seedUrl: seedUrl! };
  }
}
