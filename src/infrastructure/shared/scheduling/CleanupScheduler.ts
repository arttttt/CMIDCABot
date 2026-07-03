/**
 * CleanupScheduler - periodic cleanup of expired entries
 *
 * Generic scheduler for stores that support expiration cleanup.
 * Separated from stores for Single Responsibility Principle.
 *
 * Supports per-store cleanup intervals for flexible scheduling.
 */

import { logger } from "../logging/index.js";
import { IntervalRunner } from "./IntervalRunner.js";

/** Interface for stores that support expiration cleanup */
export interface CleanableStore {
  deleteExpired(): Promise<number>;
}

/** Entry with store and its cleanup interval */
export interface CleanableEntry {
  store: CleanableStore;
  intervalMs: number;
  name: string;
}

export class CleanupScheduler {
  private runners: Map<CleanableStore, IntervalRunner> = new Map();

  constructor(private readonly entries: CleanableEntry[]) {}

  /**
   * Start periodic cleanup for all stores
   */
  start(): void {
    for (const entry of this.entries) {
      if (this.runners.has(entry.store)) {
        continue;
      }

      const runner = new IntervalRunner(
        async () => {
          const deletedCount = await entry.store.deleteExpired();
          if (deletedCount > 0) {
            logger.debug("CleanupScheduler", "Cleanup completed", {
              store: entry.name,
              deletedCount,
              intervalMs: entry.intervalMs,
            });
          }
        },
        entry.intervalMs,
        (error) => {
          logger.error("CleanupScheduler", "Store cleanup failed", {
            store: entry.name,
            error,
          });
        },
      );

      runner.start();
      this.runners.set(entry.store, runner);
    }
  }

  /**
   * Stop periodic cleanup for all stores
   */
  stop(): void {
    for (const runner of this.runners.values()) {
      runner.stop();
    }
    this.runners.clear();
  }
}
