/**
 * GetMarketStatusUseCase - builds a live market snapshot on demand
 *
 * Read-only by design: fetches live prices, appends them to history
 * in memory only, and evaluates signals WITHOUT consulting cooldowns.
 * Persists nothing and does not affect the monitor's timers or digest.
 */

import type { PriceRepository } from "../repositories/PriceRepository.js";
import type { PriceHistoryRepository } from "../repositories/PriceHistoryRepository.js";
import type { MarketStatus } from "../models/MarketStatus.js";
import type { AssetMarketStats } from "../models/MarketDigest.js";
import type { MarketSignal } from "../models/MarketSignal.js";
import type { PricePoint } from "../models/PricePoint.js";
import { MarketStatsPolicy } from "../policies/MarketStatsPolicy.js";
import { SignalPolicy } from "../policies/SignalPolicy.js";
import { PORTFOLIO_ASSETS } from "../../types/portfolio.js";
import { DAY_MS } from "../constants/market.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export type GetMarketStatusResult =
  | { status: "success"; market: MarketStatus }
  | { status: "unavailable" }
  | { status: "error"; message: string };

export class GetMarketStatusUseCase {
  constructor(
    private priceRepository: PriceRepository | undefined,
    private priceHistoryRepository: PriceHistoryRepository,
  ) {}

  async execute(nowMs: number): Promise<GetMarketStatusResult> {
    if (!this.priceRepository) {
      logger.warn("GetMarketStatus", "Price repository unavailable");
      return { status: "unavailable" };
    }

    try {
      const prices = await this.priceRepository.getPricesRecord();

      const assets: AssetMarketStats[] = [];
      const activeSignals: MarketSignal[] = [];

      for (const symbol of PORTFOLIO_ASSETS) {
        const history = await this.priceHistoryRepository.getHistorySince(symbol, nowMs - 7 * DAY_MS);

        // Append the live price in memory so the snapshot reflects "right now"
        const livePoint: PricePoint = {
          symbol,
          priceUsdc: prices[symbol],
          timestampMs: nowMs,
          source: "live",
        };
        const points = [...history, livePoint];

        const stats = MarketStatsPolicy.build(points, nowMs);
        if (stats) assets.push(stats);

        activeSignals.push(...SignalPolicy.evaluate(points, nowMs));
      }

      return {
        status: "success",
        market: { assets, activeSignals, generatedAtMs: nowMs },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("GetMarketStatus", "Failed to build market status", { error: message });
      return { status: "error", message };
    }
  }
}
