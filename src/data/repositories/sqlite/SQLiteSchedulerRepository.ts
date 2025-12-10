/**
 * SQLite implementation of Scheduler state repository
 */
import { Database } from "../../interfaces/Database.js";
import { SchedulerRepository } from "../interfaces/SchedulerRepository.js";
import { SchedulerState } from "../../../domain/models/SchedulerState.js";

interface SchedulerStateRow {
  id: number;
  last_run_at: string | null;
  interval_ms: number;
  updated_at: string;
}

export class SQLiteSchedulerRepository implements SchedulerRepository {
  constructor(private db: Database) {
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduler_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_run_at TEXT,
        interval_ms INTEGER NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  private rowToModel(row: SchedulerStateRow): SchedulerState {
    return {
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : null,
      intervalMs: row.interval_ms,
      updatedAt: new Date(row.updated_at),
    };
  }

  getState(): SchedulerState | undefined {
    const row = this.db.get<SchedulerStateRow>(
      "SELECT id, last_run_at, interval_ms, updated_at FROM scheduler_state WHERE id = 1",
    );

    if (!row) return undefined;
    return this.rowToModel(row);
  }

  initState(intervalMs: number): void {
    this.db.run(
      `INSERT INTO scheduler_state (id, interval_ms) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET interval_ms = ?, updated_at = CURRENT_TIMESTAMP`,
      [intervalMs, intervalMs],
    );
  }

  updateLastRunAt(timestamp: Date): void {
    this.db.run(
      "UPDATE scheduler_state SET last_run_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
      [timestamp.toISOString()],
    );
  }
}
