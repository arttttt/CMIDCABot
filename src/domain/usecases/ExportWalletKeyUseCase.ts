/**
 * Export wallet key use case
 *
 * This is the only place where we explicitly decrypt the private key
 * to show it to the user. The decrypted key exists briefly in memory
 * during this operation.
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { DcaWalletConfig } from "../../types/config.js";
import { ExportKeyResult } from "./types.js";
import { logger } from "../../services/logger.js";
import type { KeyEncryptionService } from "../../services/encryption.js";

export class ExportWalletKeyUseCase {
  constructor(
    private userRepository: UserRepository,
    private encryptionService: KeyEncryptionService,
    private config: DcaWalletConfig,
  ) {}

  async execute(telegramId: number): Promise<ExportKeyResult> {
    logger.info("ExportWalletKey", "Exporting wallet key", { telegramId });

    if (this.config.devPrivateKey) {
      logger.debug("ExportWalletKey", "Dev mode - exporting shared wallet key");
      return {
        type: "dev_mode",
        privateKey: this.config.devPrivateKey,
        isDevWallet: true,
      };
    }

    const user = await this.userRepository.getById(telegramId);

    if (!user?.privateKey) {
      logger.warn("ExportWalletKey", "No wallet to export", { telegramId });
      return { type: "no_wallet" };
    }

    // Decrypt the private key for export
    // This is intentional - user explicitly requested to see their key
    const decryptedKey = await this.encryptionService.decrypt(user.privateKey);

    logger.info("ExportWalletKey", "Wallet key exported", { telegramId });
    return {
      type: "success",
      privateKey: decryptedKey,
      isDevWallet: false,
    };
  }
}
