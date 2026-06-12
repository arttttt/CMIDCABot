/**
 * MarketStatsPolicy - pure assembly of per-asset market statistics
 *
 * Shared by the daily digest and the on-demand market status.
 */

import type { PricePoint } from "../models/PricePoint.js";
import type { AssetMarketStats } from "../models/MarketDigest.js";
import { IndicatorPolicy } from "./IndicatorPolicy.js";
import { DAY_MS, RSI_PERIOD } from "../constants/market.js";

export class MarketStatsPolicy {
  /**
   * Build stats for one asset from its price history.
   * Returns null for empty history.
   *
   * @param points - ascending price history covering up to 7 days
   */
  static build(points: PricePoint[], nowMs: number): AssetMarketStats | null {
    if (points.length === 0) return null;

    const latest = points[points.length - 1];
    return {
      symbol: latest.symbol,
      price: latest.priceUsdc,
      change24hPct: IndicatorPolicy.changeOverWindow(points, DAY_MS, nowMs),
      change7dPct: IndicatorPolicy.changeOverWindow(points, 7 * DAY_MS, nowMs),
      rsi: IndicatorPolicy.rsi(IndicatorPolicy.hourlyCloses(points), RSI_PERIOD),
    };
  }
}
