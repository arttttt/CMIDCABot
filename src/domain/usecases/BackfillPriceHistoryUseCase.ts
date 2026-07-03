/**
 * BackfillPriceHistoryUseCase - warms up price history on cold start
 *
 * When stored history is empty or has a gap (server was down), fetches
 * hourly candles from the historical source and appends the missing range.
 * Failures are logged per asset and never abort startup.
 */

import type { PriceHistoryRepository } from "../repositories/PriceHistoryRepository.js";
import type { HistoricalPriceRepository } from "../repositories/HistoricalPriceRepository.js";
import { PORTFOLIO_ASSETS } from "../constants/portfolio.js";
import { BACKFILL_HOURS, BACKFILL_TRIGGER_GAP_MS, HOUR_MS } from "../constants/market.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class BackfillPriceHistoryUseCase {
  constructor(
    private priceHistoryRepository: PriceHistoryRepository,
    private historicalPriceRepository: HistoricalPriceRepository,
  ) {}

  /**
   * @returns total number of backfilled points
   */
  async execute(nowMs: number): Promise<number> {
    let total = 0;

    for (const symbol of PORTFOLIO_ASSETS) {
      try {
        const latestMs = await this.priceHistoryRepository.getLatestTimestamp(symbol);
        const gapMs = latestMs === null ? Number.POSITIVE_INFINITY : nowMs - latestMs;
        if (gapMs < BACKFILL_TRIGGER_GAP_MS) continue;

        const hours =
          latestMs === null
            ? BACKFILL_HOURS
            : Math.min(BACKFILL_HOURS, Math.ceil(gapMs / HOUR_MS) + 1);

        const candles = await this.historicalPriceRepository.getHourlyHistory(symbol, hours);
        const fresh = latestMs === null ? candles : candles.filter((p) => p.timestampMs > latestMs);

        await this.priceHistoryRepository.saveAll(fresh);
        total += fresh.length;

        logger.info("BackfillPriceHistory", "Backfilled", { symbol, points: fresh.length });
      } catch (error) {
        logger.warn("BackfillPriceHistory", "Backfill failed, continuing without it", {
          symbol,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return total;
  }
}
