/**
 * AnalyzeMarketUseCase - evaluates price history and returns actionable signals
 *
 * Applies SignalPolicy per asset, then filters out signals that are
 * still cooling down (anti-spam) via the operation lock port.
 */

import type { PriceHistoryRepository } from "../repositories/PriceHistoryRepository.js";
import type { OperationLockRepository } from "../repositories/OperationLockRepository.js";
import type { MarketSignal } from "../models/MarketSignal.js";
import { SignalPolicy } from "../policies/SignalPolicy.js";
import { PORTFOLIO_ASSETS } from "../../types/portfolio.js";
import { DAY_MS, SIGNAL_COOLDOWN_MS } from "../constants/market.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class AnalyzeMarketUseCase {
  constructor(
    private priceHistoryRepository: PriceHistoryRepository,
    private signalCooldown: OperationLockRepository,
  ) {}

  /**
   * @returns signals that fired and are not in cooldown
   */
  async execute(nowMs: number): Promise<MarketSignal[]> {
    const result: MarketSignal[] = [];

    for (const symbol of PORTFOLIO_ASSETS) {
      const points = await this.priceHistoryRepository.getHistorySince(symbol, nowMs - 7 * DAY_MS);
      const signals = SignalPolicy.evaluate(points, nowMs);

      for (const signal of signals) {
        const key = `signal:${signal.type}:${signal.symbol}`;
        const acquired = await this.signalCooldown.acquire(key, SIGNAL_COOLDOWN_MS, nowMs);
        if (acquired) {
          result.push(signal);
        } else {
          logger.debug("AnalyzeMarket", "Signal suppressed by cooldown", { key });
        }
      }
    }

    if (result.length > 0) {
      logger.info("AnalyzeMarket", "Signals fired", {
        signals: result.map((s) => `${s.type}:${s.symbol}`),
      });
    }

    return result;
  }
}
