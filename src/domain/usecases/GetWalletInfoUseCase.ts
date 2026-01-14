/**
 * Get wallet info use case
 */

import type { TelegramId } from "../models/id/index.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { GetWalletInfoResult } from "./types.js";
import { logger } from "../../infrastructure/shared/logging/index.js";
import { IsDevModeUseCase } from "./IsDevModeUseCase.js";
import { GetDevWalletInfoUseCase } from "./GetDevWalletInfoUseCase.js";
import { GetWalletInfoByAddressUseCase } from "./GetWalletInfoByAddressUseCase.js";

export class GetWalletInfoUseCase {
  constructor(
    private userRepository: UserRepository,
    private isDevModeUseCase: IsDevModeUseCase,
    private getDevWalletInfoUseCase: GetDevWalletInfoUseCase,
    private getWalletInfoByAddressUseCase: GetWalletInfoByAddressUseCase,
  ) {}

  async execute(telegramId: TelegramId): Promise<GetWalletInfoResult> {
    logger.info("GetWalletInfo", "Getting wallet info", { telegramId });

    await this.userRepository.create(telegramId);

    if (this.isDevModeUseCase.execute()) {
      logger.debug("GetWalletInfo", "Using dev mode wallet");
      const wallet = await this.getDevWalletInfoUseCase.execute();
      logger.info("GetWalletInfo", "Dev wallet info retrieved", {
        address: wallet.address,
        balance: wallet.balance,
      });
      return { type: "dev_mode", wallet };
    }

    const user = await this.userRepository.getById(telegramId);

    // Check if user has a wallet (privateKey is stored encrypted, walletAddress is plaintext)
    if (!user?.privateKey || !user?.walletAddress) {
      logger.warn("GetWalletInfo", "No wallet found", { telegramId });
      return { type: "no_wallet" };
    }

    // Use stored walletAddress instead of decrypting the key
    logger.debug("GetWalletInfo", "Fetching wallet info by address");
    const wallet = await this.getWalletInfoByAddressUseCase.execute(user.walletAddress, false);
    logger.info("GetWalletInfo", "Wallet info retrieved", {
      address: wallet.address,
      balance: wallet.balance,
    });
    return { type: "success", wallet };
  }
}
