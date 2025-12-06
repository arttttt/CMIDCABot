import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";

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

  close(): void {
    this.db.close();
  }
}
