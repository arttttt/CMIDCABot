/**
 * SwapStep - Discriminated union for swap operation progress
 *
 * Each step represents a phase in the swap execution.
 * Steps with data (quote_received) trigger new messages in UI.
 * Steps without data (getting_quote, etc.) trigger message edits.
 * The completed step contains the final result.
 */

import type { SwapQuote } from "./quote/SwapQuote.js";
import type { TxSignature } from "./id/index.js";

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
 * Swap result - success or error
 */
export type SwapResult =
  | {
      status: "success";
      quote: SwapQuote;
      signature: TxSignature;
      confirmed: boolean;
    }
  | { status: "unavailable" }
  | { status: "no_wallet" }
  | { status: "invalid_amount"; message: string }
  | { status: "operation_in_progress" }
  | { status: "invalid_asset"; message: string }
  | { status: "insufficient_usdc_balance" }
  | { status: "insufficient_sol_balance" }
  | { status: "rpc_error"; message: string }
  | { status: "quote_error"; message: string }
  | { status: "build_error"; message: string }
  | { status: "send_error"; message: string; signature?: TxSignature }
  | { status: "high_price_impact"; priceImpactPct: number };

/**
 * Swap operation steps (including completed)
 */
export type SwapStep =
  | { step: "checking_balance" }
  | { step: "getting_quote" }
  | { step: "quote_received"; quote: QuoteInfo }
  | { step: "building_transaction" }
  | { step: "sending_transaction" }
  | { step: "completed"; result: SwapResult };

/**
 * Helper constructors for swap steps
 */
export const SwapSteps = {
  checkingBalance(): SwapStep {
    return { step: "checking_balance" };
  },

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

  completed(result: SwapResult): SwapStep {
    return { step: "completed", result };
  },
} as const;
