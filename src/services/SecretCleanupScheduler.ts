/**
 * SecretCleanupScheduler - periodic cleanup of expired secrets
 *
 * Separated from SecretStore for Single Responsibility Principle.
 */

import { SecretStore } from "./SecretStore.js";

const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

export class SecretCleanupScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly secretStore: SecretStore,
    private readonly intervalMs: number = DEFAULT_CLEANUP_INTERVAL_MS,
  ) {}

  /**
   * Start periodic cleanup
   */
  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this.secretStore.deleteExpired();
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
