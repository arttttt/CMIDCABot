/**
 * Delete wallet use case
 */

import type { TelegramId } from "../models/id/index.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { WalletInfoHelper } from "../helpers/WalletInfoHelper.js";
import { DeleteWalletResult } from "./types.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class DeleteWalletUseCase {
  constructor(
    private userRepository: UserRepository,
    private walletHelper: WalletInfoHelper,
  ) {}

  async execute(telegramId: TelegramId): Promise<DeleteWalletResult> {
    logger.info("DeleteWallet", "Deleting wallet", { telegramId });

    if (this.walletHelper.isDevMode()) {
      logger.debug("DeleteWallet", "Dev mode - cannot delete shared wallet");
      return { type: "dev_mode" };
    }

    const user = await this.userRepository.getById(telegramId);

    if (!user?.privateKey) {
      logger.warn("DeleteWallet", "No wallet to delete", { telegramId });
      return { type: "no_wallet" };
    }

    await this.userRepository.clearPrivateKey(telegramId);
    logger.info("DeleteWallet", "Wallet deleted", { telegramId });
    return { type: "deleted" };
  }
}
