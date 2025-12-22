/**
 * ImportSessionStore - in-memory storage for wallet import sessions
 *
 * Stores telegramId with one-time token for secure wallet import via web form.
 * Unlike SecretStore (which stores secrets), this stores session context.
 *
 * Features:
 * - TTL with automatic expiration (10 minutes)
 * - One-time consumption (get + delete atomically)
 * - Peek without deletion (for GET form requests)
 * - Token format validation
 */

import { randomBytes } from "node:crypto";
import { logger } from "./logger.js";

/** Default TTL: 10 minutes */
export const DEFAULT_IMPORT_SESSION_TTL_MS = 10 * 60 * 1000;

/** Token format: base64url, 22 characters (16 bytes) */
const TOKEN_REGEX = /^[A-Za-z0-9_-]{22}$/;

interface ImportSession {
  telegramId: number;
  createdAt: number;
  expiresAt: number;
}

export interface ImportSessionStoreConfig {
  ttlMs?: number;
  publicUrl: string;
}

export class ImportSessionStore {
  private sessions = new Map<string, ImportSession>();
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

    logger.debug("ImportSessionStore", "Session created", {
      token: token.substring(0, 4) + "...",
      telegramId,
      expiresIn: `${this.ttlMs / 1000}s`,
    });

    return `${this.publicUrl}/import/${token}`;
  }

  /**
   * Check if token is valid without consuming it (for GET form requests)
   *
   * @param token - The session token
   * @returns true if token exists and not expired
   */
  peek(token: string): boolean {
    if (!TOKEN_REGEX.test(token)) {
      return false;
    }

    const session = this.sessions.get(token);
    if (!session) {
      return false;
    }

    // Check if expired
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return false;
    }

    return true;
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
      logger.debug("ImportSessionStore", "Invalid token format");
      return null;
    }

    const session = this.sessions.get(token);

    if (!session) {
      logger.debug("ImportSessionStore", "Session not found", {
        token: token.substring(0, 4) + "...",
      });
      return null;
    }

    // Delete immediately (one-time access)
    this.sessions.delete(token);

    // Check if expired
    if (Date.now() > session.expiresAt) {
      logger.debug("ImportSessionStore", "Session expired", {
        token: token.substring(0, 4) + "...",
        telegramId: session.telegramId,
      });
      return null;
    }

    logger.info("ImportSessionStore", "Session consumed", {
      token: token.substring(0, 4) + "...",
      telegramId: session.telegramId,
    });

    return session.telegramId;
  }

  /**
   * Delete all expired entries
   *
   * @returns Number of deleted entries
   */
  deleteExpired(): number {
    const now = Date.now();
    let deleted = 0;

    for (const [token, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(token);
        deleted++;
      }
    }

    if (deleted > 0) {
      logger.debug("ImportSessionStore", "Expired sessions cleaned up", { deleted });
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
