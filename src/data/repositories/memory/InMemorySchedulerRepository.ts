/**
 * In-memory implementation of Scheduler repository
 */
import { SchedulerRepository } from "../../../domain/repositories/SchedulerRepository.js";
import { SchedulerState } from "../../../domain/models/SchedulerState.js";

export class InMemorySchedulerRepository implements SchedulerRepository {
  private state: SchedulerState | undefined;

  async getState(): Promise<SchedulerState | undefined> {
    return this.state;
  }

  async initState(intervalMs: number): Promise<void> {
    if (this.state) {
      return;
    }

    this.state = {
      lastRunAt: null,
      intervalMs,
      updatedAt: new Date(),
    };
  }

  async updateLastRunAt(timestamp: Date): Promise<void> {
    if (this.state) {
      this.state.lastRunAt = timestamp;
      this.state.updatedAt = new Date();
    }
  }
}
