/**
 * CleanupScheduler - periodic cleanup of expired entries
 *
 * Generic scheduler for stores that support expiration cleanup.
 * Separated from stores for Single Responsibility Principle.
 */

import { logger } from "../logging/index.js";

/** Interface for stores that support expiration cleanup */
export interface CleanableStore {
  deleteExpired(): Promise<number>;
}

const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

export class CleanupScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly stores: CleanableStore[],
    private readonly intervalMs: number = DEFAULT_CLEANUP_INTERVAL_MS,
  ) {}

  /**
   * Start periodic cleanup
   */
  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(async () => {
      const results = await Promise.allSettled(
        this.stores.map((store) => store.deleteExpired()),
      );

      for (const result of results) {
        if (result.status === "rejected") {
          logger.error("CleanupScheduler", "Store cleanup failed", {
            error: result.reason,
          });
        }
      }
    }, this.intervalMs);

    // Don't prevent process exit
    this.timer.unref();
  }

  /**
   * Stop periodic cleanup
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.timer !== null;
  }
}
