/**
 * Export wallet key use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { DcaWalletConfig } from "../../types/config.js";
import { ExportKeyResult } from "./types.js";
import { logger } from "../../services/logger.js";

export class ExportWalletKeyUseCase {
  constructor(
    private userRepository: UserRepository,
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

    logger.info("ExportWalletKey", "Wallet key exported", { telegramId });
    return {
      type: "success",
      privateKey: user.privateKey,
      isDevWallet: false,
    };
  }
}
