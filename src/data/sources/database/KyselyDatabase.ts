/**
 * Kysely database factory for SQLite
 */
import { Kysely, SqliteDialect, sql } from "kysely";
import SQLite from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import type { MainDatabase } from "../../types/database.js";

/**
 * Create a Kysely instance for the main database
 */
export async function createMainDatabase(dbPath: string): Promise<Kysely<MainDatabase>> {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Kysely<MainDatabase>({
    dialect: new SqliteDialect({
      database: new SQLite(dbPath),
    }),
  });

  await initMainSchema(db);
  return db;
}

/**
 * Initialize main database schema
 */
async function initMainSchema(db: Kysely<MainDatabase>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      wallet_address TEXT,
      private_key TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL,
      tx_signature TEXT NOT NULL,
      asset_symbol TEXT NOT NULL,
      amount_usdc REAL NOT NULL,
      amount_asset REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(telegram_id)
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_symbol TEXT NOT NULL,
      price_usdc REAL NOT NULL,
      timestamp_ms INTEGER NOT NULL,
      source TEXT NOT NULL
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_price_history_asset_ts ON price_history(asset_symbol, timestamp_ms)
  `.execute(db);
}
