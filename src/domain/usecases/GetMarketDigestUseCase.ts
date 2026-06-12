/**
 * GetMarketDigestUseCase - builds daily market statistics from price history
 */

import type { PriceHistoryRepository } from "../repositories/PriceHistoryRepository.js";
import type { AssetMarketStats, MarketDigest } from "../models/MarketDigest.js";
import { IndicatorPolicy } from "../policies/IndicatorPolicy.js";
import { PORTFOLIO_ASSETS } from "../../types/portfolio.js";
import { DAY_MS, RSI_PERIOD } from "../constants/market.js";

export class GetMarketDigestUseCase {
  constructor(private priceHistoryRepository: PriceHistoryRepository) {}

  async execute(nowMs: number): Promise<MarketDigest> {
    const assets: AssetMarketStats[] = [];

    for (const symbol of PORTFOLIO_ASSETS) {
      const points = await this.priceHistoryRepository.getHistorySince(symbol, nowMs - 7 * DAY_MS);
      if (points.length === 0) continue;

      const latest = points[points.length - 1];
      assets.push({
        symbol,
        price: latest.priceUsdc,
        change24hPct: IndicatorPolicy.changeOverWindow(points, DAY_MS, nowMs),
        change7dPct: IndicatorPolicy.changeOverWindow(points, 7 * DAY_MS, nowMs),
        rsi: IndicatorPolicy.rsi(IndicatorPolicy.hourlyCloses(points), RSI_PERIOD),
      });
    }

    return { assets, generatedAtMs: nowMs };
  }
}
