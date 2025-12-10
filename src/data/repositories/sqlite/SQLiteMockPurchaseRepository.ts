/**
 * SQLite implementation of MockPurchase repository using Kysely (for development mode)
 */
import { Kysely, Selectable } from "kysely";
import { MockPurchaseRepository } from "../../../domain/repositories/MockPurchaseRepository.js";
import { MockPurchase, CreateMockPurchaseData } from "../../../domain/models/MockPurchase.js";
import { AssetSymbol } from "../../../types/portfolio.js";
import type { MockDatabase, MockPurchasesTable } from "../../types/database.js";

type MockPurchaseRow = Selectable<MockPurchasesTable>;

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

  async getByUserId(telegramId: number): Promise<MockPurchase[]> {
    const rows = await this.db
      .selectFrom("mock_purchases")
      .selectAll()
      .where("telegram_id", "=", telegramId)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map((row) => this.rowToModel(row));
  }

  async create(data: CreateMockPurchaseData): Promise<MockPurchase> {
    const row = await this.db
      .insertInto("mock_purchases")
      .values({
        telegram_id: data.telegramId,
        asset_symbol: data.assetSymbol,
        amount_sol: data.amountSol,
        amount_asset: data.amountAsset,
        price_usd: data.priceUsd,
      })
      .returning(["id", "telegram_id", "asset_symbol", "amount_sol", "amount_asset", "price_usd", "created_at"])
      .executeTakeFirstOrThrow();

    return this.rowToModel(row);
  }

  async deleteByUserId(telegramId: number): Promise<void> {
    await this.db
      .deleteFrom("mock_purchases")
      .where("telegram_id", "=", telegramId)
      .execute();
  }
}
