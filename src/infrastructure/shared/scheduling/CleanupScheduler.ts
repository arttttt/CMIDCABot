/**
 * CleanupScheduler - periodic cleanup of expired entries
 *
 * Generic scheduler for stores that support expiration cleanup.
 * Separated from stores for Single Responsibility Principle.
 *
 * Supports per-store cleanup intervals for flexible scheduling.
 */

import { logger } from "../logging/index.js";

/** Interface for stores that support expiration cleanup */
export interface CleanableStore {
  deleteExpired(): Promise<number>;
}

/** Entry with store and its cleanup interval */
export interface CleanableEntry {
  store: CleanableStore;
  intervalMs: number;
}

export class CleanupScheduler {
  private timers: Map<CleanableStore, ReturnType<typeof setInterval>> = new Map();

  constructor(private readonly entries: CleanableEntry[]) {}

  /**
   * Start periodic cleanup for all stores
   */
  start(): void {
    for (const entry of this.entries) {
      if (this.timers.has(entry.store)) {
        continue;
      }

      const timer = setInterval(async () => {
        try {
          const deletedCount = await entry.store.deleteExpired();
          if (deletedCount > 0) {
            logger.debug("CleanupScheduler", "Cleanup completed", {
              deletedCount,
              intervalMs: entry.intervalMs,
            });
          }
        } catch (error) {
          logger.error("CleanupScheduler", "Store cleanup failed", {
            error,
          });
        }
      }, entry.intervalMs);

      // Don't prevent process exit
      timer.unref();

      this.timers.set(entry.store, timer);
    }
  }

  /**
   * Stop periodic cleanup for all stores
   */
  stop(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.timers.size > 0;
  }
}
