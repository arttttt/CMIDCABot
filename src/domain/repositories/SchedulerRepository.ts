/**
 * Scheduler state repository interface
 */
import { SchedulerState } from "../models/SchedulerState.js";

export interface SchedulerRepository {
  /**
   * Get current scheduler state
   */
  getState(): Promise<SchedulerState | undefined>;

  /**
   * Initialize scheduler state with interval
   */
  initState(intervalMs: number): Promise<void>;

  /**
   * Update the last run timestamp
   */
  updateLastRunAt(timestamp: Date): Promise<void>;
}
