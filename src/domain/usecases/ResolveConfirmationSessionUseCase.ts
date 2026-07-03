/**
 * ResolveConfirmationSessionUseCase - shared confirm-flow prelude
 *
 * Validates a confirmation session (existence, ownership), refreshes the
 * quote, applies the slippage re-confirm policy and, when everything holds,
 * consumes the session so the caller may execute exactly once.
 */

import type { TelegramId, ConfirmationSessionId } from "../models/id/index.js";
import type {
  ConfirmationRepository,
  ConfirmationSession,
  ConfirmationType,
} from "../repositories/ConfirmationRepository.js";
import type { SwapRepository } from "../repositories/SwapRepository.js";
import type { SwapQuote } from "../models/quote/SwapQuote.js";
import type { AssetSymbol } from "../constants/portfolio.js";
import { SlippagePolicy } from "../policies/SlippagePolicy.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export type ResolveConfirmationResult =
  | { kind: "session_not_found" }
  | { kind: "quote_refresh_failed" }
  | {
      kind: "slippage_warning";
      confirmationType: ConfirmationType;
      originalQuote: SwapQuote;
      freshQuote: SwapQuote;
      sessionId: ConfirmationSessionId;
      ttlSeconds: number;
    }
  | { kind: "max_slippage_exceeded"; confirmationType: ConfirmationType }
  /** Session consumed - the caller MUST execute the trade exactly once */
  | { kind: "confirmed"; session: ConfirmationSession };

export class ResolveConfirmationSessionUseCase {
  constructor(
    private confirmationRepository: ConfirmationRepository,
    private swapRepository: SwapRepository,
  ) {}

  async execute(
    sessionId: ConfirmationSessionId,
    telegramId: TelegramId,
  ): Promise<ResolveConfirmationResult> {
    const session = this.confirmationRepository.get(sessionId);
    if (!session) {
      return { kind: "session_not_found" };
    }

    // Check if session belongs to this user
    if (!session.telegramId.equals(telegramId)) {
      logger.warn("ConfirmationFlow", "Session user mismatch", {
        sessionUser: session.telegramId.value,
        requestUser: telegramId.value,
      });
      return { kind: "session_not_found" };
    }

    // Get fresh quote to check slippage
    let freshQuote: SwapQuote;
    try {
      freshQuote = await this.swapRepository.getQuoteUsdcToAsset(
        session.amount,
        session.asset as AssetSymbol,
      );
    } catch (error) {
      logger.error("ConfirmationFlow", "Failed to refresh quote", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.confirmationRepository.cancel(sessionId);
      return { kind: "quote_refresh_failed" };
    }

    if (SlippagePolicy.isExceeded(session.quote, freshQuote)) {
      // Capture BEFORE updateQuote: the repository hands out a live
      // reference, and updateQuote reassigns session.quote to freshQuote
      const originalQuote = session.quote;

      if (this.confirmationRepository.updateQuote(sessionId, freshQuote)) {
        return {
          kind: "slippage_warning",
          confirmationType: session.type,
          originalQuote,
          freshQuote,
          sessionId,
          ttlSeconds: this.confirmationRepository.getTtlSeconds(),
        };
      }

      // Max re-confirms exceeded
      this.confirmationRepository.cancel(sessionId);
      return { kind: "max_slippage_exceeded", confirmationType: session.type };
    }

    // Slippage OK - consume session so the trade executes exactly once
    this.confirmationRepository.consume(sessionId);
    return { kind: "confirmed", session };
  }
}
