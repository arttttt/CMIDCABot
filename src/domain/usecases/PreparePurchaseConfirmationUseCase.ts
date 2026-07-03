/**
 * PreparePurchaseConfirmationUseCase - builds a purchase confirmation preview
 *
 * Selects the asset furthest below its target allocation, fetches a quote
 * and stores a confirmation session. The purchase itself runs later via
 * ConfirmPurchaseUseCase.
 */

import type { TelegramId } from "../models/id/index.js";
import type { ConfirmationRepository } from "../repositories/ConfirmationRepository.js";
import type { SwapRepository } from "../repositories/SwapRepository.js";
import type { DetermineAssetToBuyUseCase } from "./DetermineAssetToBuyUseCase.js";
import type { ConfirmationPreview } from "./PrepareSwapConfirmationUseCase.js";
import { SwapValidationPolicy } from "../policies/SwapValidationPolicy.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export type PreparePurchaseConfirmationResult =
  | { kind: "invalid_amount"; message: string }
  | { kind: "no_wallet" }
  | { kind: "quote_error" }
  | { kind: "ready"; preview: ConfirmationPreview };

export class PreparePurchaseConfirmationUseCase {
  constructor(
    private confirmationRepository: ConfirmationRepository,
    private swapRepository: SwapRepository,
    private determineAssetToBuy: DetermineAssetToBuyUseCase,
  ) {}

  async execute(
    telegramId: TelegramId,
    amountUsdc: number,
  ): Promise<PreparePurchaseConfirmationResult> {
    const amountCheck = SwapValidationPolicy.validateUsdcAmount(amountUsdc);
    if (!amountCheck.valid) {
      return { kind: "invalid_amount", message: amountCheck.message };
    }

    try {
      // Determine which asset to buy based on portfolio allocation
      const assetInfo = await this.determineAssetToBuy.execute(telegramId);
      if (!assetInfo) {
        return { kind: "no_wallet" };
      }

      const quote = await this.swapRepository.getQuoteUsdcToAsset(amountUsdc, assetInfo.symbol);
      const sessionId = this.confirmationRepository.store(
        telegramId,
        "portfolio_buy",
        amountUsdc,
        assetInfo.symbol,
        quote,
      );

      return {
        kind: "ready",
        preview: {
          confirmationType: "portfolio_buy",
          sessionId,
          quote,
          amount: amountUsdc,
          asset: assetInfo.symbol,
          ttlSeconds: this.confirmationRepository.getTtlSeconds(),
        },
      };
    } catch (error) {
      logger.error("PreparePurchaseConfirmation", "Failed to get quote for preview", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { kind: "quote_error" };
    }
  }
}
