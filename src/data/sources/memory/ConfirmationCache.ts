/**
 * ConfirmationCache - in-memory storage for pending purchase/swap confirmations
 *
 * Stores confirmation sessions with original quote data for slippage comparison.
 * Sessions expire after TTL (default: 60 seconds).
 *
 * Features:
 * - TTL with automatic expiration
 * - Slippage tracking (original quote vs fresh quote)
 * - Re-confirmation limit (max 1 re-confirm on slippage exceed)
 */

import { randomBytes } from "node:crypto";
import type { TelegramId } from "../../../domain/models/id/index.js";
import type { SwapQuote } from "../../../domain/repositories/SwapRepository.js";
import type { ConfirmationType, ConfirmationSession } from "../../../domain/models/ConfirmationSession.js";
import { logger } from "../../../infrastructure/shared/logging/index.js";

/** Default TTL: 60 seconds for confirmation sessions */
export const DEFAULT_CONFIRMATION_TTL_MS = 60 * 1000;

/** Maximum re-confirmations allowed on slippage exceed */
export const MAX_RECONFIRMS = 1;

/** Session ID format: base64url, 22 characters (16 bytes) */
const SESSION_ID_REGEX = /^[A-Za-z0-9_-]{22}$/;

export interface ConfirmationCacheConfig {
  ttlMs?: number;
}

export class ConfirmationCache {
  private sessions = new Map<string, ConfirmationSession>();
  private readonly ttlMs: number;

  constructor(config: ConfirmationCacheConfig = {}) {
    this.ttlMs = config.ttlMs ?? DEFAULT_CONFIRMATION_TTL_MS;
  }

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
  ): string {
    // Generate cryptographically secure session ID (16 bytes = 128 bits entropy)
    const sessionId = randomBytes(16).toString("base64url");

    const now = Date.now();
    const session: ConfirmationSession = {
      telegramId,
      type,
      amount,
      asset,
      quote,
      createdAt: now,
      expiresAt: now + this.ttlMs,
      reconfirmCount: 0,
    };

    this.sessions.set(sessionId, session);

    logger.debug("ConfirmationCache", "Session created", {
      sessionId: sessionId.substring(0, 4) + "...",
      type,
      amount,
      asset,
      expiresIn: `${this.ttlMs / 1000}s`,
    });

    return sessionId;
  }

  /**
   * Get session without consuming it (for preview/validation)
   *
   * @param sessionId - The session ID
   * @returns Session or null if not found/expired/invalid
   */
  get(sessionId: string): ConfirmationSession | null {
    if (!SESSION_ID_REGEX.test(sessionId)) {
      logger.debug("ConfirmationCache", "Invalid session ID format");
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.debug("ConfirmationCache", "Session not found", {
        sessionId: sessionId.substring(0, 4) + "...",
      });
      return null;
    }

    // Check if expired
    if (Date.now() > session.expiresAt) {
      logger.debug("ConfirmationCache", "Session expired", {
        sessionId: sessionId.substring(0, 4) + "...",
      });
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Consume a session (get and delete atomically)
   *
   * @param sessionId - The session ID
   * @returns Session or null if not found/expired/invalid
   */
  consume(sessionId: string): ConfirmationSession | null {
    const session = this.get(sessionId);
    if (!session) {
      return null;
    }

    this.sessions.delete(sessionId);

    logger.info("ConfirmationCache", "Session consumed", {
      sessionId: sessionId.substring(0, 4) + "...",
      type: session.type,
    });

    return session;
  }

  /**
   * Update session with new quote (for re-confirmation flow)
   * Increments reconfirmCount and resets expiration.
   *
   * @param sessionId - The session ID
   * @param newQuote - Fresh quote from Jupiter
   * @returns true if updated, false if session not found or max reconfirms exceeded
   */
  updateQuote(sessionId: string, newQuote: SwapQuote): boolean {
    const session = this.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.reconfirmCount >= MAX_RECONFIRMS) {
      logger.debug("ConfirmationCache", "Max reconfirms exceeded", {
        sessionId: sessionId.substring(0, 4) + "...",
        reconfirmCount: session.reconfirmCount,
      });
      return false;
    }

    // Update session with new quote and reset expiration
    const now = Date.now();
    session.quote = newQuote;
    session.reconfirmCount += 1;
    session.expiresAt = now + this.ttlMs;

    logger.debug("ConfirmationCache", "Session updated with new quote", {
      sessionId: sessionId.substring(0, 4) + "...",
      reconfirmCount: session.reconfirmCount,
    });

    return true;
  }

  /**
   * Cancel (delete) a session
   *
   * @param sessionId - The session ID
   * @returns true if deleted, false if not found
   */
  cancel(sessionId: string): boolean {
    if (!SESSION_ID_REGEX.test(sessionId)) {
      return false;
    }

    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      logger.info("ConfirmationCache", "Session cancelled", {
        sessionId: sessionId.substring(0, 4) + "...",
      });
    }
    return deleted;
  }

  /**
   * Delete all expired sessions
   *
   * @returns Number of deleted entries
   */
  async deleteExpired(): Promise<number> {
    const now = Date.now();
    let deleted = 0;

    for (const [sessionId, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
        deleted++;
      }
    }

    if (deleted > 0) {
      logger.debug("ConfirmationCache", "Expired sessions cleaned up", { deleted });
    }

    return deleted;
  }

  /**
   * Get current cache size (for monitoring)
   */
  size(): number {
    return this.sessions.size;
  }

  /**
   * Get TTL in seconds
   */
  getTtlSeconds(): number {
    return Math.round(this.ttlMs / 1000);
  }
}
