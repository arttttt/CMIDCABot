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

import { randomBytes } from "node:crypto";
import { logger } from "../../../infrastructure/shared/logging/index.js";

/** Default TTL: 10 minutes for import sessions */
export const DEFAULT_IMPORT_SESSION_TTL_MS = 10 * 60 * 1000;

/** TTL for form sessions: 5 minutes (shorter, form is already open) */
const FORM_SESSION_TTL_MS = 5 * 60 * 1000;

/** Token format: base64url, 22 characters (16 bytes) */
const TOKEN_REGEX = /^[A-Za-z0-9_-]{22}$/;

interface ImportSession {
  telegramId: number;
  createdAt: number;
  expiresAt: number;
}

interface FormSession {
  telegramId: number;
  expiresAt: number;
}

export interface ImportSessionStoreConfig {
  ttlMs?: number;
  publicUrl: string;
}

export class ImportSessionCache {
  private sessions = new Map<string, ImportSession>();
  private formSessions = new Map<string, FormSession>();
  private readonly ttlMs: number;
  private readonly publicUrl: string;

  constructor(config: ImportSessionStoreConfig) {
    this.ttlMs = config.ttlMs ?? DEFAULT_IMPORT_SESSION_TTL_MS;
    this.publicUrl = config.publicUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  /**
   * Create an import session and return the one-time URL
   *
   * @param telegramId - User ID for the import operation
   * @returns URL to access the import form
   */
  store(telegramId: number): string {
    // Generate cryptographically secure token (16 bytes = 128 bits entropy)
    const token = randomBytes(16).toString("base64url");

    const now = Date.now();
    const session: ImportSession = {
      telegramId,
      createdAt: now,
      expiresAt: now + this.ttlMs,
    };

    this.sessions.set(token, session);

    logger.debug("ImportSessionCache", "Session created", {
      token: token.substring(0, 4) + "...",
      telegramId,
      expiresIn: `${this.ttlMs / 1000}s`,
    });

    return `${this.publicUrl}/import/${token}`;
  }

  /**
   * Consume a session (get and delete atomically)
   *
   * @param token - The session token
   * @returns telegramId or null if not found/expired/invalid
   */
  consume(token: string): number | null {
    // Validate token format first
    if (!TOKEN_REGEX.test(token)) {
      logger.debug("ImportSessionCache", "Invalid token format");
      return null;
    }

    const session = this.sessions.get(token);

    if (!session) {
      logger.debug("ImportSessionCache", "Session not found", {
        token: token.substring(0, 4) + "...",
      });
      return null;
    }

    // Delete immediately (one-time access)
    this.sessions.delete(token);

    // Check if expired
    if (Date.now() > session.expiresAt) {
      logger.debug("ImportSessionCache", "Session expired", {
        token: token.substring(0, 4) + "...",
        telegramId: session.telegramId,
      });
      return null;
    }

    logger.info("ImportSessionCache", "Session consumed", {
      token: token.substring(0, 4) + "...",
      telegramId: session.telegramId,
    });

    return session.telegramId;
  }

  /**
   * Consume import token and create a form session with CSRF token.
   * Used on GET to prevent race condition between GET and POST.
   *
   * @param token - The import session token
   * @returns Object with csrfToken and telegramId, or null if invalid/expired
   */
  consumeToForm(token: string): { csrfToken: string; telegramId: number } | null {
    const telegramId = this.consume(token);

    if (telegramId === null) {
      return null;
    }

    // Generate CSRF token for the form
    const csrfToken = randomBytes(16).toString("base64url");

    const formSession: FormSession = {
      telegramId,
      expiresAt: Date.now() + FORM_SESSION_TTL_MS,
    };

    this.formSessions.set(csrfToken, formSession);

    logger.debug("ImportSessionCache", "Form session created", {
      csrfToken: csrfToken.substring(0, 4) + "...",
      telegramId,
    });

    return { csrfToken, telegramId };
  }

  /**
   * Consume form session by CSRF token.
   * Used on POST to validate the form submission.
   *
   * @param csrfToken - The CSRF token from the form
   * @returns telegramId or null if invalid/expired
   */
  consumeForm(csrfToken: string): number | null {
    if (!TOKEN_REGEX.test(csrfToken)) {
      logger.debug("ImportSessionCache", "Invalid CSRF token format");
      return null;
    }

    const formSession = this.formSessions.get(csrfToken);

    if (!formSession) {
      logger.debug("ImportSessionCache", "Form session not found", {
        csrfToken: csrfToken.substring(0, 4) + "...",
      });
      return null;
    }

    // Delete immediately (one-time access)
    this.formSessions.delete(csrfToken);

    // Check if expired
    if (Date.now() > formSession.expiresAt) {
      logger.debug("ImportSessionCache", "Form session expired", {
        csrfToken: csrfToken.substring(0, 4) + "...",
      });
      return null;
    }

    logger.info("ImportSessionCache", "Form session consumed", {
      csrfToken: csrfToken.substring(0, 4) + "...",
      telegramId: formSession.telegramId,
    });

    return formSession.telegramId;
  }

  /**
   * Delete all expired entries from both import sessions and form sessions
   *
   * @returns Number of deleted entries
   */
  async deleteExpired(): Promise<number> {
    const now = Date.now();
    let deleted = 0;

    // Clean import sessions
    for (const [token, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(token);
        deleted++;
      }
    }

    // Clean form sessions
    for (const [csrfToken, formSession] of this.formSessions) {
      if (now > formSession.expiresAt) {
        this.formSessions.delete(csrfToken);
        deleted++;
      }
    }

    if (deleted > 0) {
      logger.debug("ImportSessionCache", "Expired sessions cleaned up", { deleted });
    }

    return deleted;
  }

  /**
   * Get current store size (for monitoring)
   */
  size(): number {
    return this.sessions.size;
  }

  /**
   * Get TTL in minutes
   */
  getTtlMinutes(): number {
    return Math.round(this.ttlMs / 60000);
  }
}
