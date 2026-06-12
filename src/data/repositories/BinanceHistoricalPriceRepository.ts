/**
 * BinanceHistoricalPriceRepository - HistoricalPriceRepository backed by Binance klines
 */

import type { HistoricalPriceRepository } from "../../domain/repositories/HistoricalPriceRepository.js";
import type { PricePoint } from "../../domain/models/PricePoint.js";
import type { AssetSymbol } from "../../types/portfolio.js";
import type { BinanceKlinesClient } from "../sources/api/BinanceKlinesClient.js";

export class BinanceHistoricalPriceRepository implements HistoricalPriceRepository {
  constructor(private client: BinanceKlinesClient) {}

  async getHourlyHistory(symbol: AssetSymbol, hours: number): Promise<PricePoint[]> {
    const candles = await this.client.getHourlyCandles(symbol, hours);

    return candles.map((c) => ({
      symbol,
      priceUsdc: c.closePrice,
      timestampMs: c.closeTimeMs,
      source: "backfill" as const,
    }));
  }
}
