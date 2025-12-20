/**
 * SwapStep - Discriminated union for swap operation progress
 *
 * Each step represents a phase in the swap execution.
 * Steps with data (quote_received) trigger new messages in UI.
 * Steps without data (getting_quote, etc.) trigger message edits.
 */

/**
 * Quote information for display
 */
export interface QuoteInfo {
  inputAmount: number;
  inputSymbol: string;
  outputAmount: number;
  outputSymbol: string;
  priceImpactPct: number;
  slippageBps: number;
  route: string[];
}

/**
 * Swap operation steps
 */
export type SwapStep =
  | { step: "getting_quote" }
  | { step: "quote_received"; quote: QuoteInfo }
  | { step: "building_transaction" }
  | { step: "sending_transaction" };

/**
 * Helper constructors for swap steps
 */
export const SwapSteps = {
  gettingQuote(): SwapStep {
    return { step: "getting_quote" };
  },

  quoteReceived(quote: QuoteInfo): SwapStep {
    return { step: "quote_received", quote };
  },

  buildingTransaction(): SwapStep {
    return { step: "building_transaction" };
  },

  sendingTransaction(): SwapStep {
    return { step: "sending_transaction" };
  },
} as const;
