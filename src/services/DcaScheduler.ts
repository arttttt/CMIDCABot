/**
 * DCA Scheduler Service
 * Manages the scheduling of DCA purchases based on active users
 */

import { UserRepository } from "../domain/repositories/UserRepository.js";
import { SchedulerRepository } from "../domain/repositories/SchedulerRepository.js";
import { DcaService } from "./dca.js";
import { logger } from "./logger.js";

export interface DcaSchedulerConfig {
  intervalMs: number;
  amountUsdc: number;
}

export type DcaSchedulerStatusListener = (isRunning: boolean) => void;

export class DcaScheduler {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;
  private statusListeners: DcaSchedulerStatusListener[] = [];

  constructor(
    private userRepository: UserRepository,
    private schedulerRepository: SchedulerRepository,
    private dcaService: DcaService,
    private config: DcaSchedulerConfig,
  ) {}

  /**
   * Format interval for display
   */
  private formatInterval(ms: number): string {
    if (ms >= 86400000) return `${(ms / 86400000).toFixed(1)} days`;
    if (ms >= 3600000) return `${(ms / 3600000).toFixed(1)} hours`;
    if (ms >= 60000) return `${(ms / 60000).toFixed(1)} minutes`;
    return `${ms} ms`;
  }

  /**
   * Add a listener for scheduler status changes
   */
  addStatusListener(listener: DcaSchedulerStatusListener): void {
    this.statusListeners.push(listener);
  }

  /**
   * Notify all listeners of status change
   */
  private notifyStatusChange(): void {
    for (const listener of this.statusListeners) {
      listener(this.isRunning);
    }
  }

  /**
   * Check if scheduler is currently running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Start the scheduler if there are active users
   * Returns true if scheduler was started or already running
   */
  async start(): Promise<boolean> {
    const hasActive = await this.userRepository.hasActiveDcaUsers();

    if (!hasActive) {
      logger.info("DcaScheduler", "No active users - not starting scheduler");
      return false;
    }

    if (this.isRunning) {
      logger.debug("DcaScheduler", "Already running");
      return true;
    }

    logger.info("DcaScheduler", "Starting scheduler", {
      amountUsdc: this.config.amountUsdc,
      interval: this.formatInterval(this.config.intervalMs),
    });

    // Initialize scheduler state in database
    await this.schedulerRepository.initState(this.config.intervalMs);

    this.isRunning = true;
    this.notifyStatusChange();

    // Start catch-up process and scheduling
    await this.catchUpMissedRuns();

    return true;
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      logger.debug("DcaScheduler", "Already stopped");
      return;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.isRunning = false;
    this.notifyStatusChange();
    logger.info("DcaScheduler", "Stopped");
  }

  /**
   * Called when a user's DCA status changes
   * Will start or stop the scheduler based on active user count
   */
  async onUserStatusChanged(): Promise<void> {
    const hasActive = await this.userRepository.hasActiveDcaUsers();

    if (!hasActive && this.isRunning) {
      logger.info("DcaScheduler", "No more active users - stopping scheduler");
      this.stop();
    } else if (hasActive && !this.isRunning) {
      logger.info("DcaScheduler", "Active users found - starting scheduler");
      await this.start();
    }
  }

  /**
   * Run DCA for a specific timestamp
   */
  private async runDca(timestamp: Date): Promise<boolean> {
    logger.info("DcaScheduler", "Running scheduled purchase", {
      timestamp: timestamp.toISOString(),
    });

    try {
      const result = await this.dcaService.executeDcaForActiveUsers(this.config.amountUsdc);
      logger.info("DcaScheduler", "Completed", {
        successful: result.successful,
        processed: result.processed,
      });

      // Update last run time after successful execution
      await this.schedulerRepository.updateLastRunAt(timestamp);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("DcaScheduler", "Error running DCA", { error: message });
      return false;
    }
  }

  /**
   * Schedule the next run
   *
   * Calculates next execution time based on last run timestamp to maintain
   * consistent intervals. If no previous run exists, schedules from now.
   *
   * On execution failure, retries after 60 seconds instead of waiting
   * full interval to minimize missed purchases.
   */
  private async scheduleNextRun(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const state = await this.schedulerRepository.getState();
    const lastRunAt = state?.lastRunAt ? state.lastRunAt.getTime() : null;

    // Calculate next run relative to last execution, not current time.
    // This ensures consistent intervals even if execution takes time.
    let nextRunTime: number;
    if (lastRunAt) {
      nextRunTime = lastRunAt + this.config.intervalMs;
    } else {
      nextRunTime = Date.now() + this.config.intervalMs;
    }

    // If next run time is in the past (shouldn't happen normally),
    // execute immediately (delay = 0)
    const delay = Math.max(0, nextRunTime - Date.now());
    logger.info("DcaScheduler", "Next run scheduled", {
      nextRunAt: new Date(nextRunTime).toISOString(),
      delay: this.formatInterval(delay),
    });

    this.timeoutId = setTimeout(async () => {
      if (!this.isRunning) {
        return;
      }

      const success = await this.runDca(new Date());
      if (success) {
        this.scheduleNextRun().catch((error) => {
          const message = error instanceof Error ? error.message : "Unknown error";
          logger.error("DcaScheduler", "Failed to schedule next run", { error: message });
        });
      } else {
        logger.warn("DcaScheduler", "Retrying in 1 minute...");
        this.timeoutId = setTimeout(() => {
          this.scheduleNextRun().catch((error) => {
            const message = error instanceof Error ? error.message : "Unknown error";
            logger.error("DcaScheduler", "Failed to schedule next run", { error: message });
          });
        }, 60000);
      }
    }, delay);
  }

  /**
   * Catch up on missed runs after bot restart
   *
   * Algorithm:
   * 1. Calculate how many intervals were missed during downtime
   *    missedIntervals = floor((now - lastRunAt) / intervalMs)
   * 2. Execute each missed interval sequentially with its original timestamp
   * 3. If any execution fails, stop catch-up to prevent cascading errors
   * 4. After catch-up (or if nothing missed), schedule the next regular run
   *
   * Example: If interval is 24h, last run was 50h ago, bot will execute
   * 2 catch-up runs (for hours 24 and 48), then schedule next at hour 72.
   */
  private async catchUpMissedRuns(): Promise<void> {
    const state = await this.schedulerRepository.getState();
    const lastRunAt = state?.lastRunAt ? state.lastRunAt.getTime() : null;

    if (!lastRunAt) {
      logger.info("DcaScheduler", "No previous run found - scheduling first run");
      await this.scheduleNextRun();
      return;
    }

    const now = Date.now();
    const timeSinceLastRun = now - lastRunAt;
    // Integer division: counts only complete intervals that passed
    const missedIntervals = Math.floor(timeSinceLastRun / this.config.intervalMs);

    if (missedIntervals <= 0) {
      logger.debug("DcaScheduler", "No missed intervals - scheduling next run");
      await this.scheduleNextRun();
      return;
    }

    logger.info("DcaScheduler", "Catching up missed intervals", {
      missedIntervals,
    });

    // Execute missed runs sequentially, each with its scheduled timestamp
    for (let i = 1; i <= missedIntervals; i++) {
      if (!this.isRunning) {
        logger.warn("DcaScheduler", "Stopped during catch-up");
        return;
      }

      const missedTimestamp = new Date(lastRunAt + i * this.config.intervalMs);
      logger.debug("DcaScheduler", "Catching up missed run", {
        current: i,
        total: missedIntervals,
      });
      const success = await this.runDca(missedTimestamp);
      if (!success) {
        logger.error("DcaScheduler", "Failed to catch up run - stopping catch-up", {
          failedRun: i,
        });
        break;
      }
    }

    logger.info("DcaScheduler", "Catch-up complete - scheduling next run");
    await this.scheduleNextRun();
  }
}
