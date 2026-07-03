/**
 * Kysely database factory for authorization SQLite database
 */
import { Kysely, sql } from "kysely";
import type { AuthDatabase } from "../../types/authDatabase.js";
import { logger } from "../../../infrastructure/shared/logging/index.js";
import { openSqliteDatabase } from "./openSqliteDatabase.js";

/**
 * Create a Kysely instance for the authorization database
 */
export async function createAuthDatabase(dbPath: string): Promise<Kysely<AuthDatabase>> {
  const db = openSqliteDatabase<AuthDatabase>(dbPath);
  await initAuthSchema(db);
  logger.info("AuthDatabase", "Authorization database initialized", { path: dbPath });
  return db;
}

/**
 * Initialize authorization database schema
 */
async function initAuthSchema(db: Kysely<AuthDatabase>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS authorized_users (
      telegram_id INTEGER PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'user',
      added_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_auth_users_role ON authorized_users(role)
  `.execute(db);

  await sql`
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

  await sql`
    CREATE INDEX IF NOT EXISTS idx_invite_tokens_created_by ON invite_tokens(created_by)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_invite_tokens_expires_at ON invite_tokens(expires_at)
  `.execute(db);
}
