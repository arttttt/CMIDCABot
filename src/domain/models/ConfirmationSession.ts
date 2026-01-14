/**
 * ConfirmationSession - domain model for pending purchase/swap confirmations
 *
 * Stores confirmation sessions with original quote data for slippage comparison.
 * Sessions expire after TTL (default: 60 seconds).
 */

import type { TelegramId } from "./id/index.js";
import type { SwapQuote } from "./quote/SwapQuote.js";

/**
 * Type of confirmation: portfolio buy or swap execute
 */
export type ConfirmationType = "portfolio_buy" | "swap_execute";

/**
 * Pending confirmation session data
 */
export interface ConfirmationSession {
  telegramId: TelegramId;
  type: ConfirmationType;
  amount: number;
  asset: string;
  quote: SwapQuote;
  createdAt: number;
  expiresAt: number;
  reconfirmCount: number;
}
