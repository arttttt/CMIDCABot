/**
 * Kysely database factory for authorization SQLite database
 */
import { Kysely, SqliteDialect, sql } from "kysely";
import SQLite from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import type { AuthDatabase } from "../../types/authDatabase.js";
import { logger } from "../../../infrastructure/shared/logging/index.js";

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

  sql`
    CREATE TABLE IF NOT EXISTS invite_tokens (
      token TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      used_by INTEGER,
      used_at TEXT
    )
  `.execute(db);

  sql`
    CREATE INDEX IF NOT EXISTS idx_invite_tokens_created_by ON invite_tokens(created_by)
  `.execute(db);

  sql`
    CREATE INDEX IF NOT EXISTS idx_invite_tokens_expires_at ON invite_tokens(expires_at)
  `.execute(db);
}
