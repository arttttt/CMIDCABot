/**
 * SignalPolicy - pure rules that turn price history into buy-moment signals
 *
 * No I/O. Cooldown/anti-spam is handled by the use case, not here.
 */

import type { PricePoint } from "../models/PricePoint.js";
import type { DipSignal, MarketSignal } from "../models/MarketSignal.js";
import { IndicatorPolicy } from "./IndicatorPolicy.js";
import {
  DAY_MS,
  DIP_24H_THRESHOLD_PCT,
  DIP_7D_THRESHOLD_PCT,
  MIN_WINDOW_COVERAGE,
  RSI_OVERSOLD_THRESHOLD,
  RSI_PERIOD,
} from "../constants/market.js";

export class SignalPolicy {
  /**
   * Evaluate all signals for one asset.
   *
   * @param points - price history for the asset, ascending, covering up to 7 days
   * @param nowMs - current timestamp
   */
  static evaluate(points: PricePoint[], nowMs: number): MarketSignal[] {
    if (points.length === 0) return [];

    const latest = points[points.length - 1];
    const signals: MarketSignal[] = [];

    const dip24h = this.evaluateDip(points, nowMs, DAY_MS, DIP_24H_THRESHOLD_PCT, "dip24h");
    if (dip24h) signals.push(dip24h);

    const dip7d = this.evaluateDip(points, nowMs, 7 * DAY_MS, DIP_7D_THRESHOLD_PCT, "dip7d");
    if (dip7d) signals.push(dip7d);

    const rsi = IndicatorPolicy.rsi(IndicatorPolicy.hourlyCloses(points), RSI_PERIOD);
    if (rsi !== null && rsi < RSI_OVERSOLD_THRESHOLD) {
      signals.push({
        type: "rsiOversold",
        symbol: latest.symbol,
        currentPrice: latest.priceUsdc,
        rsi,
      });
    }

    return signals;
  }

  private static evaluateDip(
    points: PricePoint[],
    nowMs: number,
    windowMs: number,
    thresholdPct: number,
    type: DipSignal["type"],
  ): DipSignal | null {
    const oldest = points[0];
    const latest = points[points.length - 1];

    // History must cover (most of) the window, otherwise the "high" is meaningless
    if (nowMs - oldest.timestampMs < windowMs * MIN_WINDOW_COVERAGE) return null;

    const windowPoints = points.filter((p) => p.timestampMs >= nowMs - windowMs);
    const periodHigh = IndicatorPolicy.highestPrice(windowPoints);
    const drawdownPct = IndicatorPolicy.drawdownPct(latest.priceUsdc, periodHigh);
    if (drawdownPct < thresholdPct) return null;

    return {
      type,
      symbol: latest.symbol,
      currentPrice: latest.priceUsdc,
      periodHigh,
      drawdownPct,
    };
  }
}
