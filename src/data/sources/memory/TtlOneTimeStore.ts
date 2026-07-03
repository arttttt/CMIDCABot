/**
 * TtlOneTimeStore - generic in-memory store for one-time tokens with TTL
 *
 * Shared machinery for token-keyed caches:
 * - cryptographically secure token generation (16 bytes, base64url)
 * - strict token format validation
 * - one-time consumption (get + delete atomically)
 * - TTL expiration with bulk cleanup
 *
 * Not a fit for stores with richer lifecycles (peek/update/cancel) -
 * see ConfirmationCache, which manages its own sessions.
 */

import { randomBytes } from "node:crypto";
import { logger } from "../../../infrastructure/shared/logging/index.js";

/** Token format: base64url, 22 characters (16 bytes) */
const TOKEN_REGEX = /^[A-Za-z0-9_-]{22}$/;

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TtlOneTimeStore<T> {
  private entries = new Map<string, Entry<T>>();

  /**
   * @param component - Log tag identifying the owning cache
   * @param ttlMs - Entry lifetime in milliseconds
   */
  constructor(
    private readonly component: string,
    private readonly ttlMs: number,
  ) {}

  /**
   * Store a value under a fresh one-time token
   *
   * @returns The generated token
   */
  put(value: T): string {
    const token = randomBytes(16).toString("base64url");
    this.entries.set(token, { value, expiresAt: Date.now() + this.ttlMs });

    logger.debug(this.component, "Entry stored", {
      token: token.substring(0, 4) + "...",
      expiresIn: `${this.ttlMs / 1000}s`,
    });

    return token;
  }

  /**
   * Consume an entry (get and delete atomically)
   *
   * @returns The stored value, or null if not found/expired/invalid format
   */
  consume(token: string): T | null {
    if (!TOKEN_REGEX.test(token)) {
      logger.debug(this.component, "Invalid token format");
      return null;
    }

    const entry = this.entries.get(token);
    if (!entry) {
      logger.debug(this.component, "Entry not found", {
        token: token.substring(0, 4) + "...",
      });
      return null;
    }

    // Delete immediately (one-time access)
    this.entries.delete(token);

    if (Date.now() > entry.expiresAt) {
      logger.debug(this.component, "Entry expired", {
        token: token.substring(0, 4) + "...",
      });
      return null;
    }

    return entry.value;
  }

  /**
   * Delete all expired entries
   *
   * @returns Number of deleted entries
   */
  deleteExpired(): number {
    const now = Date.now();
    let deleted = 0;

    for (const [token, entry] of this.entries) {
      if (now > entry.expiresAt) {
        this.entries.delete(token);
        deleted++;
      }
    }

    if (deleted > 0) {
      logger.debug(this.component, "Expired entries cleaned up", { deleted });
    }

    return deleted;
  }

  /**
   * Get current store size (for monitoring)
   */
  size(): number {
    return this.entries.size;
  }
}
