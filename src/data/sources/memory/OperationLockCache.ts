/**
 * OperationLockCache - prevents parallel transaction execution per user
 *
 * Ensures only one transaction can be in progress per user at a time.
 * Prevents double-spend scenarios when user sends multiple swap commands quickly.
 *
 * Features:
 * - Simple acquire/release pattern
 * - TTL for automatic lock release (prevents stuck locks)
 * - Periodic cleanup via CleanupScheduler
 */

import type { TelegramId } from "../../../domain/models/id/index.js";
import type { CleanableStore } from "../../../infrastructure/shared/scheduling/CleanupScheduler.js";
import { logger } from "../../../infrastructure/shared/logging/index.js";

/** Default lock TTL: 60 seconds */
export const DEFAULT_LOCK_TTL_MS = 60 * 1000;

export interface OperationLockCacheConfig {
  /** TTL for locks in ms (default: 60 seconds) */
  ttlMs?: number;
}

export class OperationLockCache implements CleanableStore {
  private readonly locks = new Map<number, number>(); // userId -> timestamp
  private readonly ttlMs: number;

  constructor(config: OperationLockCacheConfig = {}) {
    this.ttlMs = config.ttlMs ?? DEFAULT_LOCK_TTL_MS;
  }

  /**
   * Try to acquire lock for user
   *
   * @param userId - Telegram user ID
   * @returns true if lock acquired, false if already locked
   */
  tryAcquire(userId: TelegramId): boolean {
    const now = Date.now();
    const existing = this.locks.get(userId.value);

    // Check if lock exists and not expired
    if (existing !== undefined && now - existing < this.ttlMs) {
      logger.debug("OperationLockCache", "Lock already held", {
        userId: userId.value,
        heldFor: `${Math.round((now - existing) / 1000)}s`,
      });
      return false;
    }

    this.locks.set(userId.value, now);

    logger.debug("OperationLockCache", "Lock acquired", {
      userId: userId.value,
    });

    return true;
  }

  /**
   * Release lock for user
   *
   * @param userId - Telegram user ID
   */
  release(userId: TelegramId): void {
    const deleted = this.locks.delete(userId.value);

    if (deleted) {
      logger.debug("OperationLockCache", "Lock released", {
        userId: userId.value,
      });
    }
  }

  /**
   * Delete expired locks (CleanableStore interface)
   *
   * Called periodically by CleanupScheduler to remove stuck locks.
   *
   * @returns Number of deleted entries
   */
  async deleteExpired(): Promise<number> {
    const now = Date.now();
    let deleted = 0;

    for (const [userId, timestamp] of this.locks) {
      if (now - timestamp >= this.ttlMs) {
        this.locks.delete(userId);
        deleted++;
      }
    }

    if (deleted > 0) {
      logger.debug("OperationLockCache", "Expired locks cleaned up", {
        deleted,
        remaining: this.locks.size,
      });
    }

    return deleted;
  }

  /**
   * Get current cache size (for monitoring)
   */
  size(): number {
    return this.locks.size;
  }

  /**
   * Get TTL in seconds
   */
  getTtlSeconds(): number {
    return Math.round(this.ttlMs / 1000);
  }
}
