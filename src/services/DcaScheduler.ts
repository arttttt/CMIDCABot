/**
 * DCA Scheduler Service
 * Manages the scheduling of DCA purchases based on active users
 */

import { UserRepository } from "../domain/repositories/UserRepository.js";
import { SchedulerRepository } from "../domain/repositories/SchedulerRepository.js";
import { DcaService } from "./dca.js";

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
    const activeCount = await this.userRepository.getActiveDcaCount();

    if (activeCount === 0) {
      console.log("[DCA Scheduler] No active users - not starting scheduler");
      return false;
    }

    if (this.isRunning) {
      console.log("[DCA Scheduler] Already running");
      return true;
    }

    console.log(`[DCA Scheduler] Starting scheduler: ${this.config.amountUsdc} USDC every ${this.formatInterval(this.config.intervalMs)}`);
    console.log(`[DCA Scheduler] Active users: ${activeCount}`);

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
      console.log("[DCA Scheduler] Already stopped");
      return;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.isRunning = false;
    this.notifyStatusChange();
    console.log("[DCA Scheduler] Stopped");
  }

  /**
   * Called when a user's DCA status changes
   * Will start or stop the scheduler based on active user count
   */
  async onUserStatusChanged(): Promise<void> {
    const activeCount = await this.userRepository.getActiveDcaCount();

    if (activeCount === 0 && this.isRunning) {
      console.log("[DCA Scheduler] No more active users - stopping scheduler");
      this.stop();
    } else if (activeCount > 0 && !this.isRunning) {
      console.log(`[DCA Scheduler] ${activeCount} active user(s) - starting scheduler`);
      await this.start();
    } else {
      console.log(`[DCA Scheduler] Active users: ${activeCount}, running: ${this.isRunning}`);
    }
  }

  /**
   * Run DCA for a specific timestamp
   */
  private async runDca(timestamp: Date): Promise<boolean> {
    console.log(`[DCA Scheduler] Running scheduled purchase for ${timestamp.toISOString()}`);

    try {
      const result = await this.dcaService.executeDcaForActiveUsers(this.config.amountUsdc);
      console.log(`[DCA Scheduler] Completed: ${result.successful}/${result.processed} users processed successfully`);

      // Update last run time after successful execution
      await this.schedulerRepository.updateLastRunAt(timestamp);
      return true;
    } catch (error) {
      console.error("[DCA Scheduler] Error:", error);
      return false;
    }
  }

  /**
   * Schedule the next run
   */
  private async scheduleNextRun(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const state = await this.schedulerRepository.getState();
    const lastRunAt = state?.lastRunAt ? state.lastRunAt.getTime() : null;

    let nextRunTime: number;
    if (lastRunAt) {
      nextRunTime = lastRunAt + this.config.intervalMs;
    } else {
      nextRunTime = Date.now() + this.config.intervalMs;
    }

    const delay = Math.max(0, nextRunTime - Date.now());
    console.log(`[DCA Scheduler] Next run scheduled at ${new Date(nextRunTime).toISOString()} (in ${this.formatInterval(delay)})`);

    this.timeoutId = setTimeout(async () => {
      if (!this.isRunning) {
        return;
      }

      const success = await this.runDca(new Date());
      if (success) {
        this.scheduleNextRun().catch((error) => {
          console.error("[DCA Scheduler] Failed to schedule next run:", error);
        });
      } else {
        console.log("[DCA Scheduler] Retrying in 1 minute...");
        this.timeoutId = setTimeout(() => {
          this.scheduleNextRun().catch((error) => {
            console.error("[DCA Scheduler] Failed to schedule next run:", error);
          });
        }, 60000);
      }
    }, delay);
  }

  /**
   * Catch up on missed runs
   */
  private async catchUpMissedRuns(): Promise<void> {
    const state = await this.schedulerRepository.getState();
    const lastRunAt = state?.lastRunAt ? state.lastRunAt.getTime() : null;

    if (!lastRunAt) {
      console.log("[DCA Scheduler] No previous run found - scheduling first run");
      await this.scheduleNextRun();
      return;
    }

    const now = Date.now();
    const timeSinceLastRun = now - lastRunAt;
    const missedIntervals = Math.floor(timeSinceLastRun / this.config.intervalMs);

    if (missedIntervals <= 0) {
      console.log("[DCA Scheduler] No missed intervals - scheduling next run");
      await this.scheduleNextRun();
      return;
    }

    console.log(`[DCA Scheduler] Detected ${missedIntervals} missed interval(s) - catching up...`);

    for (let i = 1; i <= missedIntervals; i++) {
      if (!this.isRunning) {
        console.log("[DCA Scheduler] Stopped during catch-up");
        return;
      }

      const missedTimestamp = new Date(lastRunAt + i * this.config.intervalMs);
      console.log(`[DCA Scheduler] Catching up missed run ${i}/${missedIntervals}`);
      const success = await this.runDca(missedTimestamp);
      if (!success) {
        console.error(`[DCA Scheduler] Failed to catch up run ${i} - stopping catch-up`);
        break;
      }
    }

    console.log("[DCA Scheduler] Catch-up complete - scheduling next run");
    await this.scheduleNextRun();
  }
}
