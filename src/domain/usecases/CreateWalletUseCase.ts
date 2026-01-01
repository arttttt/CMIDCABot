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

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.performWalletCreation(telegramId);
      } catch (error) {
        logger.error("CreateWallet", `Attempt ${attempt} failed`, { error, telegramId });

        if (attempt === MAX_RETRIES) {
          throw error;
        }

        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }

    // This should never be reached due to the throw above, but TypeScript needs it
    throw new Error("Wallet creation failed after all retries");
  }

  private async performWalletCreation(telegramId: TelegramId): Promise<CreateWalletResult> {
    logger.debug("CreateWallet", "Generating new keypair with mnemonic");
    const keypair = await this.blockchainRepository.generateKeypairFromMnemonic();

    // 1. Store seed phrase first - if this fails, DB is untouched
    const seedUrl = await this.secretStore.store(keypair.mnemonic, telegramId);

    // 2. Atomically write to database (private key + address in one transaction)
    await this.userRepository.setWalletData(
      telegramId,
      keypair.privateKeyBase64,
      keypair.address,
    );

    logger.info("CreateWallet", "Wallet created", {
      telegramId,
      address: keypair.address,
    });

    const wallet = await this.walletHelper.getWalletInfo(keypair.privateKeyBase64, false);

    return { type: "created", wallet, seedUrl };
  }
}
