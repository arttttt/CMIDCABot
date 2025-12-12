/**
 * Kysely database factory for SQLite
 */
import { Kysely, SqliteDialect, sql } from "kysely";
import SQLite, { Database } from "better-sqlite3";
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

  const sqliteDb = new SQLite(dbPath);

  // Reset database if schema is outdated
  resetMockDatabaseIfNeeded(sqliteDb);

  const db = new Kysely<MockDatabase>({
    dialect: new SqliteDialect({
      database: sqliteDb,
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
      private_key TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db);

  // Migration: add private_key column if not exists (for existing databases)
  sql`
    ALTER TABLE users ADD COLUMN private_key TEXT
  `.execute(db).catch(() => {
    // Column already exists - ignore error
  });

  sql`
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
      amount_usdc REAL NOT NULL,
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

/**
 * Expected columns for each table in mock database
 */
const MOCK_SCHEMA_VERSION = {
  purchases: ["id", "telegram_id", "asset_symbol", "amount_usdc", "amount_asset", "price_usd", "created_at"],
  portfolio: ["telegram_id", "btc_balance", "eth_balance", "sol_balance", "created_at", "updated_at"],
  scheduler_state: ["id", "last_run_at", "interval_ms", "updated_at"],
};

/**
 * Reset mock database if schema is outdated - drop all tables and let them be recreated
 */
function resetMockDatabaseIfNeeded(db: Database): void {
  const tables = ["purchases", "portfolio", "scheduler_state"] as const;

  for (const table of tables) {
    if (isTableSchemaOutdated(db, table, MOCK_SCHEMA_VERSION[table])) {
      console.log(`[DB] Schema mismatch detected for table '${table}' - resetting database...`);
      dropAllMockTables(db);
      return;
    }
  }
}

/**
 * Check if a table has outdated schema (missing expected columns)
 */
function isTableSchemaOutdated(db: Database, tableName: string, expectedColumns: string[]): boolean {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
    if (tableInfo.length === 0) {
      // Table doesn't exist - not outdated, will be created fresh
      return false;
    }

    const existingColumns = new Set(tableInfo.map((row) => row.name));

    // Check if all expected columns exist
    for (const col of expectedColumns) {
      if (!existingColumns.has(col)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Drop all mock database tables
 */
function dropAllMockTables(db: Database): void {
  db.exec("DROP TABLE IF EXISTS purchases");
  db.exec("DROP TABLE IF EXISTS portfolio");
  db.exec("DROP TABLE IF EXISTS scheduler_state");
  db.exec("DROP INDEX IF EXISTS idx_purchases_user");
  console.log("[DB] All mock tables dropped - will be recreated with fresh schema");
}
