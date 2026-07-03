/**
 * HistoricalPriceRepository - port for one-time historical price backfill
 *
 * Abstracts the external candle source (Binance, etc.) from domain layer.
 * Used only to warm up price history on cold start; not a live price source.
 */

import type { AssetSymbol } from "../constants/portfolio.js";
import type { PricePoint } from "../models/PricePoint.js";

export interface HistoricalPriceRepository {
  /**
   * Hourly close prices for the last `hours` hours, ascending by timestamp.
   * Implementations must not return unfinished (future-closing) candles.
   */
  getHourlyHistory(symbol: AssetSymbol, hours: number): Promise<PricePoint[]>;
}
