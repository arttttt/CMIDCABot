/**
 * SQLite implementation of PriceHistoryRepository using Kysely
 */
import { Kysely, Selectable } from "kysely";
import { PriceHistoryRepository } from "../../../domain/repositories/PriceHistoryRepository.js";
import { PricePoint, PricePointSource } from "../../../domain/models/PricePoint.js";
import { PRICE_HISTORY_RETENTION_MS } from "../../../domain/constants/market.js";
import { AssetSymbol } from "../../../types/portfolio.js";
import type { MainDatabase, PriceHistoryTable } from "../../types/database.js";

type PriceHistoryRow = Selectable<PriceHistoryTable>;

export class SQLitePriceHistoryRepository implements PriceHistoryRepository {
  constructor(private db: Kysely<MainDatabase>) {}

  async saveAll(points: PricePoint[]): Promise<void> {
    if (points.length === 0) return;

    await this.db
      .insertInto("price_history")
      .values(
        points.map((p) => ({
          asset_symbol: p.symbol,
          price_usdc: p.priceUsdc,
          timestamp_ms: p.timestampMs,
          source: p.source,
        })),
      )
      .execute();
  }

  async getHistorySince(symbol: AssetSymbol, fromMs: number): Promise<PricePoint[]> {
    const rows = await this.db
      .selectFrom("price_history")
      .selectAll()
      .where("asset_symbol", "=", symbol)
      .where("timestamp_ms", ">=", fromMs)
      .orderBy("timestamp_ms", "asc")
      .execute();

    return rows.map((row) => this.rowToModel(row));
  }

  async getLatestTimestamp(symbol: AssetSymbol): Promise<number | null> {
    const row = await this.db
      .selectFrom("price_history")
      .select((eb) => eb.fn.max("timestamp_ms").as("latest"))
      .where("asset_symbol", "=", symbol)
      .executeTakeFirst();

    return row?.latest ?? null;
  }

  async deleteExpired(): Promise<number> {
    const cutoffMs = Date.now() - PRICE_HISTORY_RETENTION_MS;

    const result = await this.db
      .deleteFrom("price_history")
      .where("timestamp_ms", "<", cutoffMs)
      .executeTakeFirst();

    return Number(result.numDeletedRows);
  }

  private rowToModel(row: PriceHistoryRow): PricePoint {
    return {
      symbol: row.asset_symbol as AssetSymbol,
      priceUsdc: row.price_usdc,
      timestampMs: row.timestamp_ms,
      source: row.source as PricePointSource,
    };
  }
}
