/**
 * GetMarketDigestUseCase - builds daily market statistics from price history
 */

import type { PriceHistoryRepository } from "../repositories/PriceHistoryRepository.js";
import type { AssetMarketStats, MarketDigest } from "../models/MarketDigest.js";
import { MarketStatsPolicy } from "../policies/MarketStatsPolicy.js";
import { PORTFOLIO_ASSETS } from "../constants/portfolio.js";
import { DAY_MS } from "../constants/market.js";

export class GetMarketDigestUseCase {
  constructor(private priceHistoryRepository: PriceHistoryRepository) {}

  async execute(nowMs: number): Promise<MarketDigest> {
    const assets: AssetMarketStats[] = [];

    for (const symbol of PORTFOLIO_ASSETS) {
      const points = await this.priceHistoryRepository.getHistorySince(symbol, nowMs - 7 * DAY_MS);
      const stats = MarketStatsPolicy.build(points, nowMs);
      if (stats) assets.push(stats);
    }

    return { assets, generatedAtMs: nowMs };
  }
}
