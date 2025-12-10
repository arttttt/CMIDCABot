/**
 * SQLite implementation of Portfolio repository (for mock/development mode)
 */
import { Database } from "../../interfaces/Database.js";
import { PortfolioRepository } from "../interfaces/PortfolioRepository.js";
import { PortfolioBalances } from "../../../domain/models/Portfolio.js";
import { AssetSymbol } from "../../../types/portfolio.js";

interface PortfolioRow {
  telegram_id: number;
  btc_balance: number;
  eth_balance: number;
  sol_balance: number;
  created_at: string;
  updated_at: string;
}

export class SQLitePortfolioRepository implements PortfolioRepository {
  constructor(private db: Database) {
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS portfolio (
        telegram_id INTEGER PRIMARY KEY,
        btc_balance REAL DEFAULT 0,
        eth_balance REAL DEFAULT 0,
        sol_balance REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  private rowToModel(row: PortfolioRow): PortfolioBalances {
    return {
      telegramId: row.telegram_id,
      btcBalance: row.btc_balance,
      ethBalance: row.eth_balance,
      solBalance: row.sol_balance,
    };
  }

  getById(telegramId: number): PortfolioBalances | undefined {
    const row = this.db.get<PortfolioRow>(
      "SELECT telegram_id, btc_balance, eth_balance, sol_balance, created_at, updated_at FROM portfolio WHERE telegram_id = ?",
      [telegramId],
    );

    if (!row) return undefined;
    return this.rowToModel(row);
  }

  create(telegramId: number): void {
    this.db.run(
      "INSERT OR IGNORE INTO portfolio (telegram_id) VALUES (?)",
      [telegramId],
    );
  }

  updateBalance(telegramId: number, asset: AssetSymbol, amountToAdd: number): void {
    const column = `${asset.toLowerCase()}_balance`;
    this.db.run(
      `UPDATE portfolio SET ${column} = ${column} + ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`,
      [amountToAdd, telegramId],
    );
  }

  reset(telegramId: number): void {
    this.db.run(
      "UPDATE portfolio SET btc_balance = 0, eth_balance = 0, sol_balance = 0, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?",
      [telegramId],
    );
  }
}
