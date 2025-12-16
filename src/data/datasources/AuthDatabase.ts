/**
 * Kysely database factory for authorization SQLite database
 */
import { Kysely, SqliteDialect, sql } from "kysely";
import SQLite from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import type { AuthDatabase } from "../types/authDatabase.js";
import { logger } from "../../services/logger.js";

/**
 * Create a Kysely instance for the authorization database
 */
export function createAuthDatabase(dbPath: string): Kysely<AuthDatabase> {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Kysely<AuthDatabase>({
    dialect: new SqliteDialect({
      database: new SQLite(dbPath),
    }),
  });

  initAuthSchema(db);
  logger.info("AuthDatabase", "Authorization database initialized", { path: dbPath });
  return db;
}

/**
 * Initialize authorization database schema
 */
function initAuthSchema(db: Kysely<AuthDatabase>): void {
  sql`
    CREATE TABLE IF NOT EXISTS authorized_users (
      telegram_id INTEGER PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'user',
      added_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db);

  sql`
    CREATE INDEX IF NOT EXISTS idx_auth_users_role ON authorized_users(role)
  `.execute(db);
}
