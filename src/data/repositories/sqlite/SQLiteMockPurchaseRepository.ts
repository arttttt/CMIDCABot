/**
 * SQLite implementation of MockPurchase repository (for development mode)
 */
import { Database } from "../../interfaces/Database.js";
import { MockPurchaseRepository } from "../interfaces/MockPurchaseRepository.js";
import { MockPurchase, CreateMockPurchaseData } from "../../../domain/models/MockPurchase.js";
import { AssetSymbol } from "../../../types/portfolio.js";

interface MockPurchaseRow {
  id: number;
  telegram_id: number;
  asset_symbol: string;
  amount_sol: number;
  amount_asset: number;
  price_usd: number;
  created_at: string;
}

export class SQLiteMockPurchaseRepository implements MockPurchaseRepository {
  constructor(private db: Database) {
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
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
    `);
  }

  private rowToModel(row: MockPurchaseRow): MockPurchase {
    return {
      id: row.id,
      telegramId: row.telegram_id,
      assetSymbol: row.asset_symbol as AssetSymbol,
      amountSol: row.amount_sol,
      amountAsset: row.amount_asset,
      priceUsd: row.price_usd,
      createdAt: new Date(row.created_at),
    };
  }

  getByUserId(telegramId: number): MockPurchase[] {
    const rows = this.db.all<MockPurchaseRow>(
      "SELECT id, telegram_id, asset_symbol, amount_sol, amount_asset, price_usd, created_at FROM mock_purchases WHERE telegram_id = ? ORDER BY created_at DESC",
      [telegramId],
    );

    return rows.map((row) => this.rowToModel(row));
  }

  create(data: CreateMockPurchaseData): MockPurchase {
    const result = this.db.run(
      "INSERT INTO mock_purchases (telegram_id, asset_symbol, amount_sol, amount_asset, price_usd) VALUES (?, ?, ?, ?, ?)",
      [data.telegramId, data.assetSymbol, data.amountSol, data.amountAsset, data.priceUsd],
    );

    const id = Number(result.lastInsertRowid);
    const row = this.db.get<MockPurchaseRow>(
      "SELECT id, telegram_id, asset_symbol, amount_sol, amount_asset, price_usd, created_at FROM mock_purchases WHERE id = ?",
      [id],
    );

    return this.rowToModel(row!);
  }

  deleteByUserId(telegramId: number): void {
    this.db.run(
      "DELETE FROM mock_purchases WHERE telegram_id = ?",
      [telegramId],
    );
  }
}
