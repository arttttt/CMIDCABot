/**
 * Shared SQLite bootstrap for Kysely databases
 */
import { Kysely, SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";

/**
 * Open (creating the directory if needed) a SQLite database as a Kysely instance
 */
export function openSqliteDatabase<T>(dbPath: string): Kysely<T> {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  return new Kysely<T>({
    dialect: new SqliteDialect({
      database: new SQLite(dbPath),
    }),
  });
}
