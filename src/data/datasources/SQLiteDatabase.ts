/**
 * SQLite database implementation using better-sqlite3
 */
import BetterSqlite3 from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { Database, RunResult } from "../interfaces/Database.js";

export class SQLiteDatabase implements Database {
  private db: BetterSqlite3.Database;

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new BetterSqlite3(dbPath);
  }

  run(sql: string, params: unknown[] = []): RunResult {
    const result = this.db.prepare(sql).run(...params);
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  get<T>(sql: string, params: unknown[] = []): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  all<T>(sql: string, params: unknown[] = []): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  close(): void {
    this.db.close();
  }
}
