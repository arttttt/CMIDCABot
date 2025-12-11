/**
 * Kysely database factory for SQLite
 */
import { Kysely, SqliteDialect, sql } from "kysely";
import SQLite from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import type { MainDatabase, MockDatabase } from "../types/database.js";

/**
 * Create a Kysely instance for the main database
 */
export function createMainDatabase(dbPath: string): Kysely<MainDatabase> {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Kysely<MainDatabase>({
    dialect: new SqliteDialect({
      database: new SQLite(dbPath),
    }),
  });

  initMainSchema(db);
  return db;
}

/**
 * Create a Kysely instance for the mock database
 */
export function createMockDatabase(dbPath: string): Kysely<MockDatabase> {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Kysely<MockDatabase>({
    dialect: new SqliteDialect({
      database: new SQLite(dbPath),
    }),
  });

  initMockSchema(db);
  return db;
}

/**
 * Initialize main database schema
 */
function initMainSchema(db: Kysely<MainDatabase>): void {
  sql`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      wallet_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db);

  sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL,
      tx_signature TEXT NOT NULL,
      asset_symbol TEXT NOT NULL,
      amount_sol REAL NOT NULL,
      amount_asset REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
    )
  `.execute(db);

  sql`
    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(telegram_id)
  `.execute(db);
}

/**
 * Initialize mock database schema
 */
function initMockSchema(db: Kysely<MockDatabase>): void {
  sql`
    CREATE TABLE IF NOT EXISTS portfolio (
      telegram_id INTEGER PRIMARY KEY,
      btc_balance REAL DEFAULT 0,
      eth_balance REAL DEFAULT 0,
      sol_balance REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db);

  sql`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL,
      asset_symbol TEXT NOT NULL,
      amount_sol REAL NOT NULL,
      amount_asset REAL NOT NULL,
      price_usd REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db);

  sql`
    CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(telegram_id)
  `.execute(db);

  sql`
    CREATE TABLE IF NOT EXISTS scheduler_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_run_at TEXT,
      interval_ms INTEGER NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db);
}
