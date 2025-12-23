/**
 * ResetPortfolioUseCase - resets portfolio balances and purchase history (dev-only)
 */

import { PortfolioRepository } from "../repositories/PortfolioRepository.js";
import { PurchaseRepository } from "../repositories/PurchaseRepository.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export type ResetPortfolioResult =
  | { success: true }
  | { success: false; error: string };

export class ResetPortfolioUseCase {
  constructor(
    private portfolioRepository: PortfolioRepository,
    private purchaseRepository: PurchaseRepository,
  ) {}

  async execute(telegramId: number): Promise<ResetPortfolioResult> {
    logger.info("ResetPortfolio", "Resetting portfolio", { telegramId });

    try {
      await this.portfolioRepository.reset(telegramId);
      await this.purchaseRepository.deleteByUserId(telegramId);

      logger.info("ResetPortfolio", "Portfolio reset completed", { telegramId });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("ResetPortfolio", "Portfolio reset failed", { error: errorMessage });

      return { success: false, error: errorMessage };
    }
  }
}
