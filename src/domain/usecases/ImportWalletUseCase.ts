/**
 * Import wallet use case
 * Allows users to import an existing Solana wallet via private key
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { BlockchainRepository } from "../repositories/BlockchainRepository.js";
import { WalletInfoHelper } from "./helpers/WalletInfoHelper.js";
import { ImportWalletResult } from "./types.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class ImportWalletUseCase {
  constructor(
    private userRepository: UserRepository,
    private blockchainRepository: BlockchainRepository,
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
    if (user?.privateKey && user?.walletAddress) {
      logger.info("ImportWallet", "Wallet already exists", { telegramId });
      // Use walletAddress instead of decrypting privateKey
      const wallet = await this.walletHelper.getWalletInfoByAddress(user.walletAddress, false);
      return { type: "already_exists", wallet };
    }

    // Detect input type: mnemonic (words separated by spaces) or base64 private key
    const words = privateKeyBase64.trim().split(/\s+/);
    const isMnemonic = words.length >= 12 && words.length <= 24;

    let normalizedKey: string;
    let walletAddress: string;

    if (isMnemonic) {
      // Validate as BIP39 mnemonic
      logger.debug("ImportWallet", "Detected mnemonic input");
      const mnemonicValidation = await this.blockchainRepository.validateMnemonic(privateKeyBase64);
      if (!mnemonicValidation.valid) {
        logger.warn("ImportWallet", "Invalid mnemonic", {
          telegramId,
          error: mnemonicValidation.error,
        });
        return { type: "invalid_key", error: mnemonicValidation.error };
      }
      normalizedKey = mnemonicValidation.normalizedKey!;
      walletAddress = mnemonicValidation.address!;
    } else {
      // Validate as base64 private key
      const validation = await this.blockchainRepository.validatePrivateKey(privateKeyBase64);
      if (!validation.valid) {
        logger.warn("ImportWallet", "Invalid private key", {
          telegramId,
          error: validation.error,
        });
        return { type: "invalid_key", error: validation.error };
      }
      normalizedKey = validation.normalizedKey!;
      walletAddress = validation.address!;
    }

    // Store the wallet
    await this.userRepository.setPrivateKey(telegramId, normalizedKey);
    await this.userRepository.setWalletAddress(telegramId, walletAddress);

    logger.info("ImportWallet", "Wallet imported", {
      telegramId,
      address: walletAddress,
    });

    const wallet = await this.walletHelper.getWalletInfo(normalizedKey, false);
    return { type: "imported", wallet };
  }
}
