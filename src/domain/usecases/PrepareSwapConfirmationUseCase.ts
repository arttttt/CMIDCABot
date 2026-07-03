/**
 * PrepareSwapConfirmationUseCase - builds a swap confirmation preview
 *
 * Validates input, fetches a quote and stores a confirmation session.
 * The swap itself runs later via ConfirmSwapUseCase.
 */

import type { TelegramId, ConfirmationSessionId } from "../models/id/index.js";
import type {
  ConfirmationRepository,
  ConfirmationType,
} from "../repositories/ConfirmationRepository.js";
import type { SwapRepository } from "../repositories/SwapRepository.js";
import type { SwapQuote } from "../models/quote/SwapQuote.js";
import { SwapValidationPolicy } from "../policies/SwapValidationPolicy.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

/**
 * Data needed to render a confirmation preview
 */
export interface ConfirmationPreview {
  confirmationType: ConfirmationType;
  sessionId: ConfirmationSessionId;
  quote: SwapQuote;
  amount: number;
  asset: string;
  ttlSeconds: number;
}

export type PrepareSwapConfirmationResult =
  | { kind: "invalid_amount"; message: string }
  | { kind: "invalid_asset"; message: string }
  | { kind: "quote_error" }
  | { kind: "ready"; preview: ConfirmationPreview };

export class PrepareSwapConfirmationUseCase {
  constructor(
    private confirmationRepository: ConfirmationRepository,
    private swapRepository: SwapRepository,
  ) {}

  async execute(
    telegramId: TelegramId,
    amountUsdc: number,
    asset: string,
  ): Promise<PrepareSwapConfirmationResult> {
    const amountCheck = SwapValidationPolicy.validateUsdcAmount(amountUsdc);
    if (!amountCheck.valid) {
      return { kind: "invalid_amount", message: amountCheck.message };
    }

    const assetCheck = SwapValidationPolicy.validateAsset(asset);
    if (!assetCheck.valid) {
      return { kind: "invalid_asset", message: assetCheck.message };
    }

    try {
      const quote = await this.swapRepository.getQuoteUsdcToAsset(amountUsdc, assetCheck.asset);
      const sessionId = this.confirmationRepository.store(
        telegramId,
        "swap_execute",
        amountUsdc,
        assetCheck.asset,
        quote,
      );

      return {
        kind: "ready",
        preview: {
          confirmationType: "swap_execute",
          sessionId,
          quote,
          amount: amountUsdc,
          asset: assetCheck.asset,
          ttlSeconds: this.confirmationRepository.getTtlSeconds(),
        },
      };
    } catch (error) {
      logger.error("PrepareSwapConfirmation", "Failed to get quote for preview", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { kind: "quote_error" };
    }
  }
}
