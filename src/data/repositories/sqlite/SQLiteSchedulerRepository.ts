/**
 * SQLite implementation of Scheduler state repository using Kysely
 */
import { Kysely, sql } from "kysely";
import { SchedulerRepository } from "../../../domain/repositories/SchedulerRepository.js";
import { SchedulerState } from "../../../domain/models/SchedulerState.js";
import type { MockDatabase } from "../../types/database.js";

interface SchedulerStateRow {
  id: number;
  last_run_at: string | null;
  interval_ms: number;
  updated_at: string;
}

export class SQLiteSchedulerRepository implements SchedulerRepository {
  constructor(private db: Kysely<MockDatabase>) {}

  private rowToModel(row: SchedulerStateRow): SchedulerState {
    return {
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : null,
      intervalMs: row.interval_ms,
      updatedAt: new Date(row.updated_at),
    };
  }

  getState(): SchedulerState | undefined {
    const row = this.db
      .selectFrom("scheduler_state")
      .selectAll()
      .where("id", "=", 1)
      .executeTakeFirst();

    const result = row as unknown as SchedulerStateRow | undefined;
    if (!result) return undefined;

    return this.rowToModel(result);
  }

  initState(intervalMs: number): void {
    this.db
      .insertInto("scheduler_state")
      .values({ id: 1, interval_ms: intervalMs })
      .onConflict((oc) =>
        oc.column("id").doUpdateSet({
          interval_ms: intervalMs,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
      )
      .execute();
  }

  updateLastRunAt(timestamp: Date): void {
    this.db
      .updateTable("scheduler_state")
      .set({
        last_run_at: timestamp.toISOString(),
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", 1)
      .execute();
  }
}
