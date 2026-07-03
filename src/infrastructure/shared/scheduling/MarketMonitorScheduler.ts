/**
 * MarketMonitorScheduler - periodic runner for the market monitor tick
 *
 * Timer plumbing lives in IntervalRunner; the task itself
 * (collect/analyze/notify) is injected from the composition root.
 */

import { logger } from "../logging/index.js";
import { IntervalRunner } from "./IntervalRunner.js";

export class MarketMonitorScheduler {
  private readonly runner: IntervalRunner;
  private running = false;

  constructor(
    task: () => Promise<void>,
    private readonly intervalMs: number,
  ) {
    this.runner = new IntervalRunner(task, intervalMs, (error) => {
      logger.error("MarketMonitorScheduler", "Tick failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /**
   * Start periodic execution. Runs the task once immediately.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    this.runner.start({ immediate: true });
    logger.info("MarketMonitorScheduler", "Started", { intervalMs: this.intervalMs });
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;

    this.runner.stop();
    logger.info("MarketMonitorScheduler", "Stopped");
  }
}
