/**
 * OperationLockCache - in-memory storage for operation locks
 *
 * Features:
 * - TTL-based lock expiration
 * - Lazy cleanup on acquire
 * - Optional periodic cleanup
 */

import { logger } from "../../../infrastructure/shared/logging/index.js";

/** Default cleanup interval: 5 minutes */
export const DEFAULT_OPERATION_LOCK_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

interface OperationLockEntry {
  ownerId: string;
  expiresAtMs: number;
}

export interface OperationLockCacheConfig {
  /** Interval for periodic cleanup in ms (default: 5 minutes) */
  cleanupIntervalMs?: number;
}

export class OperationLockCache {
  private readonly locks = new Map<string, OperationLockEntry>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(config: OperationLockCacheConfig = {}) {
    const cleanupIntervalMs = config.cleanupIntervalMs ?? DEFAULT_OPERATION_LOCK_CLEANUP_INTERVAL_MS;
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleEntries();
    }, cleanupIntervalMs);
    this.cleanupInterval.unref();
  }

  /**
   * Try to acquire a lock for a key.
   *
   * @returns true if acquired, false if already locked and not expired
   */
  acquire(key: string, ownerId: string, ttlMs: number, nowMs: number): boolean {
    const existing = this.locks.get(key);
    if (existing && existing.expiresAtMs > nowMs) {
      return false;
    }

    this.locks.set(key, { ownerId, expiresAtMs: nowMs + ttlMs });
    return true;
  }

  /**
   * Release a lock for a key.
   *
   * Only the same owner can release.
   */
  release(key: string, ownerId: string): boolean {
    const existing = this.locks.get(key);
    if (!existing) {
      return false;
    }
    if (existing.ownerId !== ownerId) {
      return false;
    }
    this.locks.delete(key);
    return true;
  }

  /**
   * Cleanup stale entries (expired locks).
   */
  private cleanupStaleEntries(): void {
    const nowMs = Date.now();
    let deleted = 0;

    for (const [key, entry] of this.locks) {
      if (entry.expiresAtMs <= nowMs) {
        this.locks.delete(key);
        deleted++;
      }
    }

    if (deleted > 0) {
      logger.debug("OperationLockCache", "Stale entries cleaned up", {
        deleted,
        remaining: this.locks.size,
      });
    }
  }

  /**
   * Stop periodic cleanup (for graceful shutdown).
   */
  dispose(): void {
    clearInterval(this.cleanupInterval);
  }
}
