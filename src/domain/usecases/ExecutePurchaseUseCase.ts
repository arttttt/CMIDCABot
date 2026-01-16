/**
 * Execute purchase use case - real swap via Jupiter
 * Automatically selects the asset furthest below target allocation
 *
 * Streams progress via execute() AsyncGenerator.
 */

import type { TelegramId } from "../models/id/index.js";
import type { AssetSymbol } from "../../types/portfolio.js";
import type { PurchaseResult } from "./types.js";
import type { ExecuteSwapUseCase } from "./ExecuteSwapUseCase.js";
import type { SwapResult } from "../models/SwapStep.js";
import { logger } from "../../infrastructure/shared/logging/index.js";
import { PurchaseStep, PurchaseSteps } from "../models/index.js";
import type { DetermineAssetToBuyUseCase } from "./DetermineAssetToBuyUseCase.js";
import { MIN_USDC_AMOUNT, MAX_USDC_AMOUNT } from "../constants.js";
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
      yield PurchaseSteps.completed({ type: "operation_in_progress" });
      return;
    }

    try {
      // Validate amount
      if (isNaN(amountUsdc) || amountUsdc <= 0) {
        logger.warn("ExecutePurchase", "Invalid amount", { amountUsdc });
        yield PurchaseSteps.completed({ type: "invalid_amount" });
        return;
      }

      // Defense-in-depth: validate amount here for fast feedback to user,
      // even though ExecuteSwapUseCase will also validate.
      // This prevents unnecessary asset selection when amount is clearly invalid.
      if (amountUsdc < MIN_USDC_AMOUNT) {
        yield PurchaseSteps.completed({
          type: "invalid_amount",
          error: `Minimum amount is ${MIN_USDC_AMOUNT} USDC`,
        });
        return;
      }

      if (amountUsdc > MAX_USDC_AMOUNT) {
        yield PurchaseSteps.completed({
          type: "invalid_amount",
          error: `Maximum amount is ${MAX_USDC_AMOUNT} USDC`,
        });
        return;
      }

      // Step: Selecting asset
      yield PurchaseSteps.selectingAsset();

      // Determine which asset to buy based on portfolio allocation
      const selection = await this.determineAssetToBuy.execute(telegramId);

      if (!selection) {
        logger.warn("ExecutePurchase", "No wallet connected", { telegramId });
        yield PurchaseSteps.completed({ type: "no_wallet" });
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
          // Map swap result to purchase result
          const purchaseResult = this.mapSwapResultToPurchaseResult(
            swapStep.result,
            selection.symbol,
            amountUsdc,
          );
          yield PurchaseSteps.completed(purchaseResult);
        } else {
          // Wrap swap step in purchase step
          yield PurchaseSteps.swap(swapStep);
        }
      }
    } finally {
      await this.operationLockRepository.release(lockKey);
    }
  }

  /**
   * Map SwapResult to PurchaseResult
   */
  private mapSwapResultToPurchaseResult(
    swapResult: SwapResult,
    asset: AssetSymbol,
    amountUsdc: number,
  ): PurchaseResult {
    switch (swapResult.status) {
      case "success": {
        const priceUsd = amountUsdc / swapResult.quote.outputAmount;
        logger.info("ExecutePurchase", "Purchase completed", {
          signature: swapResult.signature,
          confirmed: swapResult.confirmed,
          asset,
          amount: swapResult.quote.outputAmount,
          amountUsdc,
          priceUsd,
        });
        return {
          type: "success",
          asset,
          amountAsset: swapResult.quote.outputAmount,
          amountUsdc,
          priceUsd,
          signature: swapResult.signature,
          confirmed: swapResult.confirmed,
        };
      }
      case "unavailable":
        return { type: "unavailable" };
      case "no_wallet":
        return { type: "no_wallet" };
      case "invalid_amount":
        return { type: "invalid_amount", error: swapResult.message };
      case "operation_in_progress":
        return { type: "operation_in_progress" };
      case "invalid_asset":
        // This should not happen since we control the asset selection
        return { type: "invalid_amount", error: swapResult.message };
      case "insufficient_usdc_balance":
        return { type: "insufficient_usdc_balance" };
      case "insufficient_sol_balance":
        return { type: "insufficient_sol_balance" };
      case "quote_error":
        return { type: "quote_error", error: swapResult.message };
      case "build_error":
        return { type: "build_error", error: swapResult.message };
      case "send_error":
        return { type: "send_error", error: swapResult.message, signature: swapResult.signature };
      case "rpc_error":
        return { type: "rpc_error", error: swapResult.message };
      case "high_price_impact":
        return { type: "high_price_impact", error: `Price impact too high: ${swapResult.priceImpactPct.toFixed(2)}%` };
    }
  }

}
