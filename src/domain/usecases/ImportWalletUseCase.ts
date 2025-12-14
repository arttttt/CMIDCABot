/**
 * Import wallet use case
 * Allows users to import an existing Solana wallet via private key
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { SolanaService } from "../../services/solana.js";
import { WalletInfoHelper } from "./helpers/WalletInfoHelper.js";
import { ImportWalletResult } from "./types.js";
import { logger } from "../../services/logger.js";

export class ImportWalletUseCase {
  constructor(
    private userRepository: UserRepository,
    private solana: SolanaService,
    private walletHelper: WalletInfoHelper,
  ) {}

  async execute(telegramId: number, privateKeyBase64: string): Promise<ImportWalletResult> {
    logger.info("ImportWallet", "Importing wallet", { telegramId });

    // Ensure user exists
    await this.userRepository.create(telegramId);

    // Check dev mode
    if (this.walletHelper.isDevMode()) {
      logger.debug("ImportWallet", "Dev mode - cannot import wallets");
      const wallet = await this.walletHelper.getDevWalletInfo();
      return { type: "dev_mode", wallet };
    }

    // Check if wallet already exists
    const user = await this.userRepository.getById(telegramId);
    if (user?.privateKey) {
      logger.info("ImportWallet", "Wallet already exists", { telegramId });
      const wallet = await this.walletHelper.getWalletInfo(user.privateKey, false);
      return { type: "already_exists", wallet };
    }

    // Validate the private key
    const validation = await this.solana.validatePrivateKey(privateKeyBase64);
    if (!validation.valid) {
      logger.warn("ImportWallet", "Invalid private key", {
        telegramId,
        error: validation.error,
      });
      return { type: "invalid_key", error: validation.error };
    }

    // Store the wallet (use normalized key from validation)
    await this.userRepository.setPrivateKey(telegramId, validation.normalizedKey!);
    await this.userRepository.setWalletAddress(telegramId, validation.address!);

    logger.info("ImportWallet", "Wallet imported", {
      telegramId,
      address: validation.address,
    });

    const wallet = await this.walletHelper.getWalletInfo(validation.normalizedKey!, false);
    return { type: "imported", wallet };
  }
}
