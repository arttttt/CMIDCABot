/**
 * Get balance use case
 */

import type { TelegramId } from "../models/id/index.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { BlockchainRepository } from "../repositories/BlockchainRepository.js";
import { BalanceResult } from "./types.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class GetBalanceUseCase {
  constructor(
    private userRepository: UserRepository,
    private blockchainRepository: BlockchainRepository,
  ) {}

  async execute(telegramId: TelegramId): Promise<BalanceResult> {
    logger.info("GetBalance", "Checking balance", { telegramId });

    await this.userRepository.create(telegramId);

    const user = await this.userRepository.getById(telegramId);

    if (!user?.walletAddress) {
      logger.warn("GetBalance", "No wallet connected", { telegramId });
      return { type: "no_wallet" };
    }

    try {
      logger.debug("GetBalance", "Fetching balance from blockchain", {
        walletAddress: user.walletAddress,
      });
      const balance = await this.blockchainRepository.getBalance(user.walletAddress);
      logger.info("GetBalance", "Balance retrieved", {
        address: user.walletAddress,
        balance,
      });
      return {
        type: "success",
        wallet: { address: user.walletAddress, balance },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("GetBalance", "Failed to fetch balance", { error: message });
      return { type: "fetch_error" };
    }
  }
}
