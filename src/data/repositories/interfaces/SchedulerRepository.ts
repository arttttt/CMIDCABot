/**
 * Scheduler state repository interface
 */
import { SchedulerState } from "../../../domain/models/SchedulerState.js";

export interface SchedulerRepository {
  /**
   * Get current scheduler state
   */
  getState(): SchedulerState | undefined;

  /**
   * Initialize scheduler state with interval
   */
  initState(intervalMs: number): void;

  /**
   * Update the last run timestamp
   */
  updateLastRunAt(timestamp: Date): void;
}
