/**
 * SlippagePolicy - domain policy for evaluating quote slippage
 */

import type { SwapQuote } from "../models/quote/SwapQuote.js";

export class SlippagePolicy {
  /**
   * Calculate price difference in basis points between two quotes
   */
  static calculateBps(originalQuote: SwapQuote, freshQuote: SwapQuote): number {
    const priceDiff =
      (freshQuote.outputAmount - originalQuote.outputAmount) /
      originalQuote.outputAmount;
    return Math.abs(priceDiff * 10000);
  }

  /**
   * Check if slippage exceeds the threshold defined in original quote
   */
  static isExceeded(originalQuote: SwapQuote, freshQuote: SwapQuote): boolean {
    const slippageBps = this.calculateBps(originalQuote, freshQuote);
    return slippageBps > originalQuote.slippageBps;
  }
}
