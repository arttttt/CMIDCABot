/**
 * SlippageCalculator - calculates slippage between quotes
 *
 * Compares original and fresh quotes to determine if price movement
 * exceeds acceptable threshold.
 */

import type { SwapQuote } from "../repositories/SwapRepository.js";

export class SlippageCalculator {
  /**
   * Calculate price difference in basis points between two quotes
   *
   * @param originalQuote - The original quote
   * @param freshQuote - The fresh quote to compare
   * @returns Slippage in basis points (absolute value)
   */
  static calculateBps(originalQuote: SwapQuote, freshQuote: SwapQuote): number {
    const priceDiff =
      (freshQuote.outputAmount - originalQuote.outputAmount) /
      originalQuote.outputAmount;
    return Math.abs(priceDiff * 10000);
  }

  /**
   * Check if slippage exceeds the threshold defined in original quote
   *
   * @param originalQuote - The original quote (contains slippageBps threshold)
   * @param freshQuote - The fresh quote to compare
   * @returns true if slippage exceeds threshold
   */
  static isExceeded(originalQuote: SwapQuote, freshQuote: SwapQuote): boolean {
    const slippageBps = SlippageCalculator.calculateBps(
      originalQuote,
      freshQuote,
    );
    return slippageBps > originalQuote.slippageBps;
  }
}
