/**
 * GetQuoteUseCase - Fetches swap quote from Jupiter
 * Dev-only use case for testing swap integration without executing
 */

import { JupiterSwapService, SwapQuote } from "../../services/jupiter-swap.js";
import { TOKEN_MINTS } from "../../services/price.js";
import { AssetSymbol } from "../../types/portfolio.js";

export type GetQuoteResult =
  | { status: "success"; quote: SwapQuote }
  | { status: "unavailable" }
  | { status: "invalid_amount"; message: string }
  | { status: "invalid_asset"; message: string }
  | { status: "error"; message: string };

const SUPPORTED_ASSETS: AssetSymbol[] = ["BTC", "ETH", "SOL"];

export class GetQuoteUseCase {
  constructor(private jupiterSwap: JupiterSwapService | undefined) {}

  /**
   * Get quote for USDC → asset swap
   * @param amountUsdc Amount of USDC to spend
   * @param asset Target asset (BTC, ETH, SOL). Defaults to SOL.
   */
  async execute(amountUsdc: number, asset: string = "SOL"): Promise<GetQuoteResult> {
    if (!this.jupiterSwap) {
      return { status: "unavailable" };
    }

    // Validate amount
    if (isNaN(amountUsdc) || amountUsdc <= 0) {
      return {
        status: "invalid_amount",
        message: "Amount must be a positive number",
      };
    }

    // Minimum amount check
    if (amountUsdc < 0.01) {
      return {
        status: "invalid_amount",
        message: "Minimum amount is 0.01 USDC",
      };
    }

    // Validate asset
    const assetUpper = asset.toUpperCase() as AssetSymbol;
    if (!SUPPORTED_ASSETS.includes(assetUpper)) {
      return {
        status: "invalid_asset",
        message: `Unsupported asset: ${asset}. Supported: ${SUPPORTED_ASSETS.join(", ")}`,
      };
    }

    const outputMint = TOKEN_MINTS[assetUpper];

    try {
      const quote = await this.jupiterSwap.getQuoteUsdcToToken(amountUsdc, outputMint);
      return { status: "success", quote };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { status: "error", message };
    }
  }
}
