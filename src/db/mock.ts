/**
 * Mock Database Service - separate database for development/testing
 * Only used when NODE_ENV=development
 */

import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { AssetSymbol } from "../types/portfolio.js";

export interface PortfolioData {
  telegramId: number;
  btcBalance: number;
  ethBalance: number;
  solBalance: number;
}

export interface SchedulerState {
  lastRunAt: string | null; // ISO 8601 timestamp
  intervalMs: number;
}

export class MockDatabaseService {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS portfolio (
        telegram_id INTEGER PRIMARY KEY,
        btc_balance REAL DEFAULT 0,
        eth_balance REAL DEFAULT 0,
        sol_balance REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS mock_purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER NOT NULL,
        asset_symbol TEXT NOT NULL,
        amount_sol REAL NOT NULL,
        amount_asset REAL NOT NULL,
        price_usd REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_mock_purchases_user
        ON mock_purchases(telegram_id);

      CREATE TABLE IF NOT EXISTS scheduler_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_run_at TEXT,
        interval_ms INTEGER NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  getPortfolio(telegramId: number): PortfolioData | undefined {
    const row = this.db
      .prepare("SELECT telegram_id, btc_balance, eth_balance, sol_balance FROM portfolio WHERE telegram_id = ?")
      .get(telegramId) as { telegram_id: number; btc_balance: number; eth_balance: number; sol_balance: number } | undefined;

    if (!row) return undefined;

    return {
      telegramId: row.telegram_id,
      btcBalance: row.btc_balance,
      ethBalance: row.eth_balance,
      solBalance: row.sol_balance,
    };
  }

  createPortfolio(telegramId: number): void {
    this.db
      .prepare("INSERT OR IGNORE INTO portfolio (telegram_id) VALUES (?)")
      .run(telegramId);
  }

  updatePortfolioBalance(telegramId: number, asset: AssetSymbol, amountToAdd: number): void {
    const column = `${asset.toLowerCase()}_balance`;
    this.db
      .prepare(`UPDATE portfolio SET ${column} = ${column} + ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`)
      .run(amountToAdd, telegramId);
  }

  addMockPurchase(telegramId: number, asset: AssetSymbol, amountSol: number, amountAsset: number, priceUsd: number): void {
    this.db
      .prepare("INSERT INTO mock_purchases (telegram_id, asset_symbol, amount_sol, amount_asset, price_usd) VALUES (?, ?, ?, ?, ?)")
      .run(telegramId, asset, amountSol, amountAsset, priceUsd);
  }

  resetPortfolio(telegramId: number): void {
    this.db
      .prepare("UPDATE portfolio SET btc_balance = 0, eth_balance = 0, sol_balance = 0, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?")
      .run(telegramId);
    this.db
      .prepare("DELETE FROM mock_purchases WHERE telegram_id = ?")
      .run(telegramId);
  }

  /**
   * Get the current scheduler state
   */
  getSchedulerState(): SchedulerState | undefined {
    const row = this.db
      .prepare("SELECT last_run_at, interval_ms FROM scheduler_state WHERE id = 1")
      .get() as { last_run_at: string | null; interval_ms: number } | undefined;

    if (!row) return undefined;

    return {
      lastRunAt: row.last_run_at,
      intervalMs: row.interval_ms,
    };
  }

  /**
   * Initialize or update scheduler state with interval
   */
  initSchedulerState(intervalMs: number): void {
    this.db
      .prepare(`
        INSERT INTO scheduler_state (id, interval_ms) VALUES (1, ?)
        ON CONFLICT(id) DO UPDATE SET interval_ms = ?, updated_at = CURRENT_TIMESTAMP
      `)
      .run(intervalMs, intervalMs);
  }

  /**
   * Update the last run timestamp after successful DCA execution
   */
  updateLastRunAt(timestamp: string): void {
    this.db
      .prepare("UPDATE scheduler_state SET last_run_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1")
      .run(timestamp);
  }

  close(): void {
    this.db.close();
  }
}
