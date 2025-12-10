/**
 * SQLite implementation of MockPurchase repository using Kysely (for development mode)
 */
import { Kysely } from "kysely";
import { MockPurchaseRepository } from "../../../domain/repositories/MockPurchaseRepository.js";
import { MockPurchase, CreateMockPurchaseData } from "../../../domain/models/MockPurchase.js";
import { AssetSymbol } from "../../../types/portfolio.js";
import type { MockDatabase } from "../../types/database.js";

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
  constructor(private db: Kysely<MockDatabase>) {}

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
    const rows = this.db
      .selectFrom("mock_purchases")
      .selectAll()
      .where("telegram_id", "=", telegramId)
      .orderBy("created_at", "desc")
      .execute();

    const results = rows as unknown as MockPurchaseRow[];
    return results.map((row) => this.rowToModel(row));
  }

  create(data: CreateMockPurchaseData): MockPurchase {
    const result = this.db
      .insertInto("mock_purchases")
      .values({
        telegram_id: data.telegramId,
        asset_symbol: data.assetSymbol,
        amount_sol: data.amountSol,
        amount_asset: data.amountAsset,
        price_usd: data.priceUsd,
      })
      .returning(["id", "telegram_id", "asset_symbol", "amount_sol", "amount_asset", "price_usd", "created_at"])
      .executeTakeFirst();

    const row = result as unknown as MockPurchaseRow;
    return this.rowToModel(row);
  }

  deleteByUserId(telegramId: number): void {
    this.db
      .deleteFrom("mock_purchases")
      .where("telegram_id", "=", telegramId)
      .execute();
  }
}
