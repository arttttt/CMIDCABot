/**
 * ImportSessionCache - in-memory storage for wallet import sessions
 *
 * Stores telegramId with one-time token for secure wallet import via web form.
 * Unlike SecretCache (which stores secrets), this stores session context.
 *
 * Features:
 * - TTL with automatic expiration (10 minutes)
 * - One-time consumption (get + delete atomically)
 * - CSRF protection via form sessions
 * - Token format validation
 */

import { type TelegramId } from "../../../domain/models/id/index.js";
import { logger } from "../../../infrastructure/shared/logging/index.js";
import { TtlOneTimeStore } from "./TtlOneTimeStore.js";

/** Default TTL: 10 minutes for import sessions */
export const DEFAULT_IMPORT_SESSION_TTL_MS = 10 * 60 * 1000;

/** TTL for form sessions: 5 minutes (shorter, form is already open) */
const FORM_SESSION_TTL_MS = 5 * 60 * 1000;

export interface ImportSessionStoreConfig {
  ttlMs?: number;
  publicUrl: string;
}

export class ImportSessionCache {
  private readonly sessions: TtlOneTimeStore<TelegramId>;
  private readonly formSessions: TtlOneTimeStore<TelegramId>;
  private readonly ttlMs: number;
  private readonly publicUrl: string;

  constructor(config: ImportSessionStoreConfig) {
    this.ttlMs = config.ttlMs ?? DEFAULT_IMPORT_SESSION_TTL_MS;
    this.publicUrl = config.publicUrl.replace(/\/$/, ""); // Remove trailing slash
    this.sessions = new TtlOneTimeStore<TelegramId>("ImportSessionCache", this.ttlMs);
    this.formSessions = new TtlOneTimeStore<TelegramId>(
      "ImportSessionCache:form",
      FORM_SESSION_TTL_MS,
    );
  }

  /**
   * Create an import session and return the one-time URL
   *
   * @param telegramId - User ID for the import operation
   * @returns URL to access the import form
   */
  store(telegramId: TelegramId): string {
    const token = this.sessions.put(telegramId);

    logger.debug("ImportSessionCache", "Session created", { telegramId });

    return `${this.publicUrl}/import/${token}`;
  }

  /**
   * Consume a session (get and delete atomically)
   *
   * @param token - The session token
   * @returns telegramId or null if not found/expired/invalid
   */
  consume(token: string): TelegramId | null {
    const telegramId = this.sessions.consume(token);
    if (telegramId === null) {
      return null;
    }

    logger.info("ImportSessionCache", "Session consumed", {
      token: token.substring(0, 4) + "...",
      telegramId,
    });

    return telegramId;
  }

  /**
   * Consume import token and create a form session with CSRF token.
   * Used on GET to prevent race condition between GET and POST.
   *
   * @param token - The import session token
   * @returns Object with csrfToken and telegramId, or null if invalid/expired
   */
  consumeToForm(token: string): { csrfToken: string; telegramId: TelegramId } | null {
    const telegramId = this.consume(token);

    if (telegramId === null) {
      return null;
    }

    const csrfToken = this.formSessions.put(telegramId);

    logger.debug("ImportSessionCache", "Form session created", { telegramId });

    return { csrfToken, telegramId };
  }

  /**
   * Consume form session by CSRF token.
   * Used on POST to validate the form submission.
   *
   * @param csrfToken - The CSRF token from the form
   * @returns telegramId or null if invalid/expired
   */
  consumeForm(csrfToken: string): TelegramId | null {
    const telegramId = this.formSessions.consume(csrfToken);
    if (telegramId === null) {
      return null;
    }

    logger.info("ImportSessionCache", "Form session consumed", { telegramId });

    return telegramId;
  }

  /**
   * Delete all expired entries from both import sessions and form sessions
   *
   * @returns Number of deleted entries
   */
  async deleteExpired(): Promise<number> {
    return this.sessions.deleteExpired() + this.formSessions.deleteExpired();
  }

  /**
   * Get current store size (for monitoring)
   */
  size(): number {
    return this.sessions.size();
  }

  /**
   * Get TTL in minutes
   */
  getTtlMinutes(): number {
    return Math.round(this.ttlMs / 60000);
  }
}
