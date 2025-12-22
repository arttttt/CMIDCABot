/**
 * SecretCleanupScheduler - periodic cleanup of expired secrets
 *
 * Separated from SecretStore for Single Responsibility Principle.
 * Supports multiple stores with deleteExpired() method.
 */

/** Interface for stores that support expiration cleanup */
export interface CleanableStore {
  deleteExpired(): number;
}

const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

export class SecretCleanupScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly stores: CleanableStore[];

  constructor(
    store: CleanableStore,
    private readonly intervalMs: number = DEFAULT_CLEANUP_INTERVAL_MS,
  ) {
    this.stores = [store];
  }

  /**
   * Add additional store to cleanup
   */
  addStore(store: CleanableStore): void {
    this.stores.push(store);
  }

  /**
   * Start periodic cleanup
   */
  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      for (const store of this.stores) {
        store.deleteExpired();
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
