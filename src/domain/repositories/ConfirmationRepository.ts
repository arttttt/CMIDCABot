/**
 * ConfirmationRepository - interface for pending purchase/swap confirmations
 *
 * Stores confirmation sessions with original quote data for slippage comparison.
 * Sessions expire after TTL (default: 60 seconds).
 *
 * Features:
 * - TTL with automatic expiration
 * - Slippage tracking (original quote vs fresh quote)
 * - Re-confirmation limit (max 1 re-confirm on slippage exceed)
 */

import type { TelegramId, ConfirmationSessionId } from "../models/id/index.js";
import type { SwapQuote } from "./SwapRepository.js";
import type { ConfirmationType, ConfirmationSession } from "../models/ConfirmationSession.js";

// Re-export ConfirmationSessionId for convenience
export type { ConfirmationSessionId } from "../models/id/index.js";

// Re-export types for consumers of this module
export type { ConfirmationType, ConfirmationSession } from "../models/ConfirmationSession.js";

export interface ConfirmationRepository {
  /**
   * Create a confirmation session and return the session ID
   *
   * @param telegramId - User ID
   * @param type - Type of confirmation (portfolio_buy or swap_execute)
   * @param amount - Amount in USDC
   * @param asset - Target asset symbol
   * @param quote - Original quote from Jupiter
   * @returns Session ID
   */
  store(
    telegramId: TelegramId,
    type: ConfirmationType,
    amount: number,
    asset: string,
    quote: SwapQuote,
  ): ConfirmationSessionId;

  /**
   * Get session without consuming it (for preview/validation)
   *
   * @param sessionId - The session ID
   * @returns Session or null if not found/expired/invalid
   */
  get(sessionId: ConfirmationSessionId): ConfirmationSession | null;

  /**
   * Consume a session (get and delete atomically)
   *
   * @param sessionId - The session ID
   * @returns Session or null if not found/expired/invalid
   */
  consume(sessionId: ConfirmationSessionId): ConfirmationSession | null;

  /**
   * Update session with new quote (for re-confirmation flow)
   * Increments reconfirmCount and resets expiration.
   *
   * @param sessionId - The session ID
   * @param newQuote - Fresh quote from Jupiter
   * @returns true if updated, false if session not found or max reconfirms exceeded
   */
  updateQuote(sessionId: ConfirmationSessionId, newQuote: SwapQuote): boolean;

  /**
   * Cancel (delete) a session
   *
   * @param sessionId - The session ID
   * @returns true if deleted, false if not found
   */
  cancel(sessionId: ConfirmationSessionId): boolean;

  /**
   * Get TTL in seconds (for user display)
   */
  getTtlSeconds(): number;
}
