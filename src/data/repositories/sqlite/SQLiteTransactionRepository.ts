/**
 * SQLite implementation of Transaction repository
 */
import { Database } from "../../interfaces/Database.js";
import { TransactionRepository } from "../interfaces/TransactionRepository.js";
import { Transaction, CreateTransactionData } from "../../../domain/models/Transaction.js";
import { AssetSymbol } from "../../../types/portfolio.js";

interface TransactionRow {
  id: number;
  telegram_id: number;
  tx_signature: string;
  asset_symbol: string;
  amount_sol: number;
  amount_asset: number;
  created_at: string;
}

export class SQLiteTransactionRepository implements TransactionRepository {
  constructor(private db: Database) {
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
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

  private rowToModel(row: TransactionRow): Transaction {
    return {
      id: row.id,
      telegramId: row.telegram_id,
      txSignature: row.tx_signature,
      assetSymbol: row.asset_symbol as AssetSymbol,
      amountSol: row.amount_sol,
      amountAsset: row.amount_asset,
      createdAt: new Date(row.created_at),
    };
  }

  getById(id: number): Transaction | undefined {
    const row = this.db.get<TransactionRow>(
      "SELECT id, telegram_id, tx_signature, asset_symbol, amount_sol, amount_asset, created_at FROM transactions WHERE id = ?",
      [id],
    );

    if (!row) return undefined;
    return this.rowToModel(row);
  }

  getByUserId(telegramId: number): Transaction[] {
    const rows = this.db.all<TransactionRow>(
      "SELECT id, telegram_id, tx_signature, asset_symbol, amount_sol, amount_asset, created_at FROM transactions WHERE telegram_id = ? ORDER BY created_at DESC",
      [telegramId],
    );

    return rows.map((row) => this.rowToModel(row));
  }

  create(data: CreateTransactionData): Transaction {
    const result = this.db.run(
      "INSERT INTO transactions (telegram_id, tx_signature, asset_symbol, amount_sol, amount_asset) VALUES (?, ?, ?, ?, ?)",
      [data.telegramId, data.txSignature, data.assetSymbol, data.amountSol, data.amountAsset],
    );

    const id = Number(result.lastInsertRowid);
    return this.getById(id)!;
  }
}
