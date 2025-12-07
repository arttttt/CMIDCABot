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

export class DatabaseService {
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
      CREATE TABLE IF NOT EXISTS users (
        telegram_id INTEGER PRIMARY KEY,
        wallet_address TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER NOT NULL,
        tx_signature TEXT NOT NULL,
        asset_symbol TEXT NOT NULL,
        amount_sol REAL NOT NULL,
        amount_asset REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_user
        ON transactions(telegram_id);

      CREATE TABLE IF NOT EXISTS portfolio (
        telegram_id INTEGER PRIMARY KEY,
        btc_balance REAL DEFAULT 0,
        eth_balance REAL DEFAULT 0,
        sol_balance REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
      );

      CREATE TABLE IF NOT EXISTS mock_purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER NOT NULL,
        asset_symbol TEXT NOT NULL,
        amount_sol REAL NOT NULL,
        amount_asset REAL NOT NULL,
        price_usd REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
      );

      CREATE INDEX IF NOT EXISTS idx_mock_purchases_user
        ON mock_purchases(telegram_id);
    `);
  }

  getUser(telegramId: number): { telegramId: number; walletAddress: string | null } | undefined {
    const row = this.db
      .prepare("SELECT telegram_id, wallet_address FROM users WHERE telegram_id = ?")
      .get(telegramId) as { telegram_id: number; wallet_address: string | null } | undefined;

    if (!row) return undefined;

    return {
      telegramId: row.telegram_id,
      walletAddress: row.wallet_address,
    };
  }

  createUser(telegramId: number): void {
    this.db
      .prepare("INSERT OR IGNORE INTO users (telegram_id) VALUES (?)")
      .run(telegramId);
  }

  setWalletAddress(telegramId: number, walletAddress: string): void {
    this.db
      .prepare("UPDATE users SET wallet_address = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?")
      .run(walletAddress, telegramId);
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

  getAllUsersWithWallet(): { telegramId: number; walletAddress: string }[] {
    const rows = this.db
      .prepare("SELECT telegram_id, wallet_address FROM users WHERE wallet_address IS NOT NULL AND wallet_address != ''")
      .all() as { telegram_id: number; wallet_address: string }[];

    return rows.map(row => ({
      telegramId: row.telegram_id,
      walletAddress: row.wallet_address,
    }));
  }

  close(): void {
    this.db.close();
  }
}
