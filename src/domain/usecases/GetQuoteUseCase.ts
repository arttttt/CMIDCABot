/**
 * GetQuoteUseCase - Fetches swap quote from Jupiter
 * Dev-only use case for testing swap integration without executing
 */

import { SwapRepository } from "../repositories/SwapRepository.js";
import type { SwapQuote } from "../models/quote/SwapQuote.js";
import { logger } from "../../infrastructure/shared/logging/index.js";
import { SwapValidationPolicy } from "../policies/SwapValidationPolicy.js";

export type GetQuoteResult =
  | { status: "success"; quote: SwapQuote }
  | { status: "invalid_amount"; message: string }
  | { status: "invalid_asset"; message: string }
  | { status: "error"; message: string };

export class GetQuoteUseCase {
  constructor(private swapRepository: SwapRepository) {}

  /**
   * Get quote for USDC → asset swap
   * @param amountUsdc Amount of USDC to spend
   * @param asset Target asset (BTC, ETH, SOL). Defaults to SOL.
   */
  async execute(amountUsdc: number, asset: string = "SOL"): Promise<GetQuoteResult> {
    logger.info("GetQuote", "Getting swap quote", { amountUsdc, asset });

    const amountCheck = SwapValidationPolicy.validateUsdcAmount(amountUsdc);
    if (!amountCheck.valid) {
      logger.warn("GetQuote", "Invalid amount", { amountUsdc });
      return { status: "invalid_amount", message: amountCheck.message };
    }

    const assetCheck = SwapValidationPolicy.validateAsset(asset);
    if (!assetCheck.valid) {
      logger.warn("GetQuote", "Invalid asset", { asset });
      return { status: "invalid_asset", message: assetCheck.message };
    }

    try {
      const quote = await this.swapRepository.getQuoteUsdcToAsset(amountUsdc, assetCheck.asset);
      logger.info("GetQuote", "Quote received", {
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        priceImpact: quote.priceImpactPct,
      });
      return { status: "success", quote };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("GetQuote", "Quote failed", { error: message });
      return { status: "error", message };
    }
  }
}
