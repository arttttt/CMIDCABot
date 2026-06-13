/**
 * SlippagePolicy - domain policy for evaluating quote slippage
 */

import type { SwapQuote } from "../models/quote/SwapQuote.js";

export class SlippagePolicy {
  /**
   * Calculate price difference in basis points between two quotes
   */
  static calculateBps(originalQuote: SwapQuote, freshQuote: SwapQuote): number {
    // A non-positive original output is a malformed quote — treat as max
    // slippage so the swap is rejected/re-confirmed, never silently passed
    // (division would otherwise yield NaN and make isExceeded a no-op).
    if (originalQuote.outputAmount <= 0) {
      return Number.POSITIVE_INFINITY;
    }

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
