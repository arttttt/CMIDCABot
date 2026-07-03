/**
 * Execute purchase use case - real swap via Jupiter
 * Automatically selects the asset furthest below target allocation
 *
 * Streams progress via execute() AsyncGenerator.
 */

import type { TelegramId } from "../models/id/index.js";
import type { ExecuteSwapUseCase } from "./ExecuteSwapUseCase.js";
import { logger } from "../../infrastructure/shared/logging/index.js";
import { PurchaseStep, PurchaseSteps } from "../models/index.js";
import type { DetermineAssetToBuyUseCase } from "./DetermineAssetToBuyUseCase.js";
import { SwapValidationPolicy } from "../policies/SwapValidationPolicy.js";
import type { OperationLockRepository } from "../repositories/OperationLockRepository.js";
import { BalanceOperationLock } from "../constants/BalanceOperationLock.js";

export class ExecutePurchaseUseCase {
  constructor(
    private executeSwapUseCase: ExecuteSwapUseCase,
    private determineAssetToBuy: DetermineAssetToBuyUseCase,
    private operationLockRepository: OperationLockRepository,
  ) {}

  /**
   * Execute purchase with streaming progress
   * @param telegramId User's Telegram ID
   * @param amountUsdc Amount of USDC to spend
   * @yields PurchaseStep - progress updates and final result
   */
  async *execute(
    telegramId: TelegramId,
    amountUsdc: number,
  ): AsyncGenerator<PurchaseStep> {
    logger.info("ExecutePurchase", "Executing portfolio purchase", {
      telegramId,
      amountUsdc,
    });

    const lockKey = BalanceOperationLock.getKey(telegramId);
    const lockAcquired = await this.operationLockRepository.acquire(
      lockKey,
      BalanceOperationLock.TTL_MS,
      Date.now(),
    );

    if (!lockAcquired) {
      yield PurchaseSteps.completed({ status: "operation_in_progress" });
      return;
    }

    try {
      // Defense-in-depth: validate amount here for fast feedback to user,
      // even though ExecuteSwapUseCase will also validate.
      // This prevents unnecessary asset selection when amount is clearly invalid.
      const amountCheck = SwapValidationPolicy.validateUsdcAmount(amountUsdc);
      if (!amountCheck.valid) {
        logger.warn("ExecutePurchase", "Invalid amount", { amountUsdc });
        yield PurchaseSteps.completed({ status: "invalid_amount", message: amountCheck.message });
        return;
      }

      // Step: Selecting asset
      yield PurchaseSteps.selectingAsset();

      // Determine which asset to buy based on portfolio allocation.
      // A fetch failure must abort the purchase — never fall back to a
      // default asset on incomplete data.
      let selection;
      try {
        selection = await this.determineAssetToBuy.execute(telegramId);
      } catch (error) {
        logger.error("ExecutePurchase", "Failed to determine asset to buy", {
          error: error instanceof Error ? error.message : String(error),
        });
        yield PurchaseSteps.completed({
          status: "quote_error",
          message: "Failed to fetch balances or prices",
        });
        return;
      }

      if (!selection) {
        logger.warn("ExecutePurchase", "No wallet connected", { telegramId });
        yield PurchaseSteps.completed({ status: "no_wallet" });
        return;
      }

      logger.info("ExecutePurchase", "Selected asset to buy", {
        symbol: selection.symbol,
        currentAllocation: `${(selection.currentAllocation * 100).toFixed(1)}%`,
        targetAllocation: `${(selection.targetAllocation * 100).toFixed(1)}%`,
        deviation: `${(selection.deviation * 100).toFixed(1)}%`,
      });

      // Step: Asset selected with allocation info
      yield PurchaseSteps.assetSelected(selection);

      // Delegate to ExecuteSwapUseCase with progress forwarding
      // Note: Balance checks (USDC, SOL) are performed by ExecuteSwapUseCase
      for await (const swapStep of this.executeSwapUseCase.execute(
        telegramId,
        amountUsdc,
        selection.symbol,
        { skipLock: true },
      )) {
        if (swapStep.step === "completed") {
          if (swapStep.result.status === "success") {
            logger.info("ExecutePurchase", "Purchase completed", {
              signature: swapStep.result.signature,
              confirmed: swapStep.result.confirmed,
              asset: selection.symbol,
              amount: swapStep.result.quote.outputAmount,
              amountUsdc,
            });
          }
          yield PurchaseSteps.completed(swapStep.result);
        } else {
          // Wrap swap step in purchase step
          yield PurchaseSteps.swap(swapStep);
        }
      }
    } finally {
      await this.operationLockRepository.release(lockKey);
    }
  }
}
