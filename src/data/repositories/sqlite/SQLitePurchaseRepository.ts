/**
 * SQLite implementation of Purchase repository using Kysely
 */
import { Kysely, Selectable } from "kysely";
import { PurchaseRepository } from "../../../domain/repositories/PurchaseRepository.js";
import { Purchase, CreatePurchaseData } from "../../../domain/models/Purchase.js";
import { telegramId, type TelegramId } from "../../../types/id/index.js";
import { AssetSymbol } from "../../../types/portfolio.js";
import type { MockDatabase, PurchasesTable } from "../../types/database.js";

type PurchaseRow = Selectable<PurchasesTable>;

export class SQLitePurchaseRepository implements PurchaseRepository {
  constructor(private db: Kysely<MockDatabase>) {}

  private rowToModel(row: PurchaseRow): Purchase {
    return {
      id: row.id,
      telegramId: telegramId(row.telegram_id),
      assetSymbol: row.asset_symbol as AssetSymbol,
      amountUsdc: row.amount_usdc,
      amountAsset: row.amount_asset,
      priceUsd: row.price_usd,
      createdAt: new Date(row.created_at),
    };
  }

  async getByUserId(id: TelegramId): Promise<Purchase[]> {
    const rows = await this.db
      .selectFrom("purchases")
      .selectAll()
      .where("telegram_id", "=", id as number)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map((row) => this.rowToModel(row));
  }

  async create(data: CreatePurchaseData): Promise<Purchase> {
    const row = await this.db
      .insertInto("purchases")
      .values({
        telegram_id: data.telegramId as number,
        asset_symbol: data.assetSymbol,
        amount_usdc: data.amountUsdc,
        amount_asset: data.amountAsset,
        price_usd: data.priceUsd,
      })
      .returning(["id", "telegram_id", "asset_symbol", "amount_usdc", "amount_asset", "price_usd", "created_at"])
      .executeTakeFirstOrThrow();

    return this.rowToModel(row);
  }

  async deleteByUserId(id: TelegramId): Promise<void> {
    await this.db
      .deleteFrom("purchases")
      .where("telegram_id", "=", id as number)
      .execute();
  }
}
