/**
 * SQLite implementation of Scheduler state repository using Kysely
 */
import { Kysely, sql, Selectable } from "kysely";
import { SchedulerRepository } from "../../../domain/repositories/SchedulerRepository.js";
import { SchedulerState } from "../../../domain/models/SchedulerState.js";
import type { MainDatabase, SchedulerStateTable } from "../../types/database.js";

type SchedulerStateRow = Selectable<SchedulerStateTable>;

export class SQLiteSchedulerRepository implements SchedulerRepository {
  constructor(private db: Kysely<MainDatabase>) {}

  private rowToModel(row: SchedulerStateRow): SchedulerState {
    return {
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : null,
      intervalMs: row.interval_ms,
      updatedAt: new Date(row.updated_at),
    };
  }

  async getState(): Promise<SchedulerState | undefined> {
    const row = await this.db
      .selectFrom("scheduler_state")
      .selectAll()
      .where("id", "=", 1)
      .executeTakeFirst();

    if (!row) return undefined;

    return this.rowToModel(row);
  }

  async initState(intervalMs: number): Promise<void> {
    await this.db
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

  async updateLastRunAt(timestamp: Date): Promise<void> {
    await this.db
      .updateTable("scheduler_state")
      .set({
        last_run_at: timestamp.toISOString(),
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", 1)
      .execute();
  }
}
