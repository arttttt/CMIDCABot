/**
 * RateLimitCache - in-memory storage for rate limit tracking
 *
 * Features:
 * - Sliding window algorithm via timestamp storage
 * - Lazy cleanup on each check (removes expired entries)
 * - Periodic cleanup for inactive users (configurable interval)
 * - Thread-safe for single-threaded Node.js
 */

import { logger } from "../../../infrastructure/shared/logging/index.js";

/** Default cleanup interval: 5 minutes */
export const DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

export interface RateLimitCacheConfig {
  /** Interval for periodic cleanup in ms (default: 5 minutes) */
  cleanupIntervalMs?: number;
  /** Window size in ms */
  windowMs: number;
  /** Maximum requests allowed in window */
  maxRequests: number;
}

export class RateLimitCache {
  private readonly requests = new Map<string, number[]>();
  private readonly cleanupInterval: NodeJS.Timeout;
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(config: RateLimitCacheConfig) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
    const cleanupIntervalMs = config.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;

    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleEntries();
    }, cleanupIntervalMs);

    // Don't block process exit
    this.cleanupInterval.unref();
  }

  /**
   * Count requests in window and record new request if under limit
   *
   * Performs lazy cleanup of expired timestamps for this key.
   *
   * @param key - Rate limit key
   * @param nowMs - Current timestamp
   * @returns Object with allowed flag and current count
   */
  checkAndRecord(key: string, nowMs: number): { allowed: boolean; count: number } {
    const windowStart = nowMs - this.windowMs;

    // Get existing timestamps and filter expired ones (lazy cleanup)
    const timestamps = this.requests.get(key) ?? [];
    const validTimestamps = timestamps.filter((t) => t >= windowStart);

    const count = validTimestamps.length;

    if (count >= this.maxRequests) {
      // Over limit - update with cleaned timestamps but don't add new one
      this.requests.set(key, validTimestamps);
      return { allowed: false, count };
    }

    // Under limit - add new timestamp
    validTimestamps.push(nowMs);
    this.requests.set(key, validTimestamps);

    return { allowed: true, count: count + 1 };
  }

  /**
   * Cleanup stale entries (users with no recent requests)
   *
   * Called periodically to prevent memory growth from inactive users.
   */
  private cleanupStaleEntries(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let deleted = 0;

    for (const [key, timestamps] of this.requests) {
      // Filter to valid timestamps
      const validTimestamps = timestamps.filter((t) => t >= windowStart);

      if (validTimestamps.length === 0) {
        // No valid timestamps - remove entry entirely
        this.requests.delete(key);
        deleted++;
      } else if (validTimestamps.length !== timestamps.length) {
        // Some expired - update with cleaned list
        this.requests.set(key, validTimestamps);
      }
    }

    if (deleted > 0) {
      logger.debug("RateLimitCache", "Stale entries cleaned up", {
        deleted,
        remaining: this.requests.size,
      });
    }
  }

  /**
   * Get current cache size (for monitoring)
   */
  size(): number {
    return this.requests.size;
  }

  /**
   * Stop periodic cleanup (for graceful shutdown)
   */
  dispose(): void {
    clearInterval(this.cleanupInterval);
  }
}
