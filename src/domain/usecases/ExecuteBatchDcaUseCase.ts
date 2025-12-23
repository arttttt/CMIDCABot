/**
 * ExecuteBatchDcaUseCase - executes DCA for all active users (scheduler)
 *
 * This use case is called by DcaScheduler to process batch purchases.
 * Dev-only: uses mock purchases instead of real swaps.
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { BalanceRepository } from "../repositories/BalanceRepository.js";
import { PriceRepository } from "../repositories/PriceRepository.js";
import { ExecuteMockPurchaseUseCase } from "./ExecuteMockPurchaseUseCase.js";
import { divideAmount } from "../../infrastructure/shared/math/index.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export interface BatchDcaResult {
  processed: number;
  successful: number;
}

export class ExecuteBatchDcaUseCase {
  constructor(
    private userRepository: UserRepository,
    private balanceRepository: BalanceRepository,
    private priceRepository: PriceRepository,
    private executeMockPurchase: ExecuteMockPurchaseUseCase,
  ) {}

  async execute(amountUsdc: number): Promise<BatchDcaResult> {
    const users = await this.userRepository.getAllActiveDcaUsers();
    let processed = 0;
    let successful = 0;

    if (users.length === 0) {
      logger.debug("ExecuteBatchDca", "No active users to process");
      return { processed: 0, successful: 0 };
    }

    logger.info("ExecuteBatchDca", "Processing active users", { count: users.length });

    // Get current prices for SOL balance check
    const prices = await this.priceRepository.getPricesRecord();
    const requiredSol = divideAmount(amountUsdc, prices.SOL).toNumber();

    for (const user of users) {
      processed++;

      try {
        // Check SOL balance
        const solBalance = await this.balanceRepository.getSolBalance(user.walletAddress);
        if (solBalance < requiredSol) {
          logger.warn("ExecuteBatchDca", "Insufficient balance", {
            telegramId: user.telegramId,
            balance: solBalance,
            required: requiredSol,
          });
          continue;
        }

        // Execute mock purchase
        const result = await this.executeMockPurchase.execute(user.telegramId, amountUsdc);
        if (result.success) {
          successful++;
          logger.info("ExecuteBatchDca", "Mock purchase executed", {
            telegramId: user.telegramId,
            asset: result.asset,
            amount: result.amount,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("ExecuteBatchDca", "Failed to process user", {
          telegramId: user.telegramId,
          error: errorMessage,
        });
      }
    }

    logger.info("ExecuteBatchDca", "Batch complete", { processed, successful });

    return { processed, successful };
  }
}
