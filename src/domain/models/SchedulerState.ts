/**
 * SchedulerState domain model
 */
export interface SchedulerState {
  lastRunAt: Date | null;
  intervalMs: number;
  updatedAt: Date;
}
