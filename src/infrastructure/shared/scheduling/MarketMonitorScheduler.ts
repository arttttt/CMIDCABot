/**
 * MarketMonitorScheduler - periodic runner for the market monitor tick
 *
 * Mirrors CleanupScheduler: plain setInterval with error isolation.
 * The task itself (collect/analyze/notify) is injected from the composition root.
 */

import { logger } from "../logging/index.js";

export class MarketMonitorScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly task: () => Promise<void>,
    private readonly intervalMs: number,
  ) {}

  /**
   * Start periodic execution. Runs the task once immediately.
   */
  start(): void {
    if (this.timer) return;

    void this.runSafely();

    this.timer = setInterval(() => {
      void this.runSafely();
    }, this.intervalMs);

    // Don't prevent process exit
    this.timer.unref();

    logger.info("MarketMonitorScheduler", "Started", { intervalMs: this.intervalMs });
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    logger.info("MarketMonitorScheduler", "Stopped");
  }

  private async runSafely(): Promise<void> {
    try {
      await this.task();
    } catch (error) {
      logger.error("MarketMonitorScheduler", "Tick failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
