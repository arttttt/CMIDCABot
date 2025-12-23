/**
 * GetQuoteUseCase - Fetches swap quote from Jupiter
 * Dev-only use case for testing swap integration without executing
 */

import { SwapRepository, SwapQuote } from "../repositories/SwapRepository.js";
import { TOKEN_MINTS } from "../../data/sources/api/JupiterPriceClient.js";
import { AssetSymbol } from "../../types/portfolio.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export type GetQuoteResult =
  | { status: "success"; quote: SwapQuote }
  | { status: "unavailable" }
  | { status: "invalid_amount"; message: string }
  | { status: "invalid_asset"; message: string }
  | { status: "error"; message: string };

const SUPPORTED_ASSETS: AssetSymbol[] = ["BTC", "ETH", "SOL"];

export class GetQuoteUseCase {
  constructor(private swapRepository: SwapRepository | undefined) {}

  /**
   * Get quote for USDC → asset swap
   * @param amountUsdc Amount of USDC to spend
   * @param asset Target asset (BTC, ETH, SOL). Defaults to SOL.
   */
  async execute(amountUsdc: number, asset: string = "SOL"): Promise<GetQuoteResult> {
    logger.info("GetQuote", "Getting swap quote", { amountUsdc, asset });

    if (!this.swapRepository) {
      logger.warn("GetQuote", "Swap repository unavailable");
      return { status: "unavailable" };
    }

    // Validate amount
    if (isNaN(amountUsdc) || amountUsdc <= 0) {
      logger.warn("GetQuote", "Invalid amount", { amountUsdc });
      return {
        status: "invalid_amount",
        message: "Amount must be a positive number",
      };
    }

    // Minimum amount check
    if (amountUsdc < 0.01) {
      logger.warn("GetQuote", "Amount below minimum", { amountUsdc });
      return {
        status: "invalid_amount",
        message: "Minimum amount is 0.01 USDC",
      };
    }

    // Validate asset
    const assetUpper = asset.toUpperCase() as AssetSymbol;
    if (!SUPPORTED_ASSETS.includes(assetUpper)) {
      logger.warn("GetQuote", "Invalid asset", { asset });
      return {
        status: "invalid_asset",
        message: `Unsupported asset: ${asset}. Supported: ${SUPPORTED_ASSETS.join(", ")}`,
      };
    }

    const outputMint = TOKEN_MINTS[assetUpper];

    try {
      const quote = await this.swapRepository!.getQuoteUsdcToToken(amountUsdc, outputMint);
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
