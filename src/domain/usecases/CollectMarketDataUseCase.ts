/**
 * CollectMarketDataUseCase - fetches current prices and appends them to history
 */

import type { PriceRepository } from "../repositories/PriceRepository.js";
import type { PriceHistoryRepository } from "../repositories/PriceHistoryRepository.js";
import type { PricePoint } from "../models/PricePoint.js";
import { PORTFOLIO_ASSETS } from "../constants/portfolio.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class CollectMarketDataUseCase {
  constructor(
    private priceRepository: PriceRepository,
    private priceHistoryRepository: PriceHistoryRepository,
  ) {}

  /**
   * Fetch current prices for all portfolio assets and persist them.
   *
   * @returns the stored points
   */
  async execute(nowMs: number): Promise<PricePoint[]> {
    const prices = await this.priceRepository.getPricesRecord();

    const points: PricePoint[] = PORTFOLIO_ASSETS.map((symbol) => ({
      symbol,
      priceUsdc: prices[symbol],
      timestampMs: nowMs,
      source: "live",
    }));

    await this.priceHistoryRepository.saveAll(points);

    logger.debug("CollectMarketData", "Prices collected", { prices });

    return points;
  }
}
