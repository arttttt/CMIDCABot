/**
 * SQLite implementation of User repository
 */
import { Database } from "../../interfaces/Database.js";
import { UserRepository } from "../../../domain/repositories/UserRepository.js";
import { User, UserWithWallet } from "../../../domain/models/User.js";

interface UserRow {
  telegram_id: number;
  wallet_address: string | null;
  created_at: string;
  updated_at: string;
}

export class SQLiteUserRepository implements UserRepository {
  constructor(private db: Database) {
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        telegram_id INTEGER PRIMARY KEY,
        wallet_address TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  private rowToModel(row: UserRow): User {
    return {
      telegramId: row.telegram_id,
      walletAddress: row.wallet_address,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  getById(telegramId: number): User | undefined {
    const row = this.db.get<UserRow>(
      "SELECT telegram_id, wallet_address, created_at, updated_at FROM users WHERE telegram_id = ?",
      [telegramId],
    );

    if (!row) return undefined;
    return this.rowToModel(row);
  }

  create(telegramId: number): void {
    this.db.run(
      "INSERT OR IGNORE INTO users (telegram_id) VALUES (?)",
      [telegramId],
    );
  }

  setWalletAddress(telegramId: number, walletAddress: string): void {
    this.db.run(
      "UPDATE users SET wallet_address = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?",
      [walletAddress, telegramId],
    );
  }

  getAllWithWallet(): UserWithWallet[] {
    const rows = this.db.all<UserRow>(
      "SELECT telegram_id, wallet_address, created_at, updated_at FROM users WHERE wallet_address IS NOT NULL AND wallet_address != ''",
    );

    return rows.map((row) => ({
      telegramId: row.telegram_id,
      walletAddress: row.wallet_address!,
    }));
  }
}
