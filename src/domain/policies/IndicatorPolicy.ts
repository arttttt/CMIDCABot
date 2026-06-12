/**
 * IndicatorPolicy - pure technical indicator calculations
 *
 * No I/O, no repository calls. Uses Decimal.js for precision,
 * mirroring AllocationPolicy.
 */

import { toDecimal } from "../../infrastructure/shared/math/index.js";
import type { PricePoint } from "../models/PricePoint.js";
import { HOUR_MS } from "../constants/market.js";

export class IndicatorPolicy {
  /**
   * Highest price among points. Returns 0 for an empty array.
   */
  static highestPrice(points: PricePoint[]): number {
    let high = 0;
    for (const p of points) {
      if (p.priceUsdc > high) high = p.priceUsdc;
    }
    return high;
  }

  /**
   * Drawdown of `current` from `high`, as a positive percent.
   * Returns 0 when high is not positive (no meaningful reference).
   */
  static drawdownPct(current: number, high: number): number {
    if (high <= 0) return 0;
    return toDecimal(high).minus(current).div(high).times(100).toNumber();
  }

  /**
   * Percent change from `from` to `to`.
   * Returns 0 when `from` is not positive.
   */
  static changePct(from: number, to: number): number {
    if (from <= 0) return 0;
    return toDecimal(to).minus(from).div(from).times(100).toNumber();
  }

  /**
   * Percent change over a time window ending at `nowMs`.
   * Baseline is the first point inside the window.
   * Returns null when history does not reach the window start.
   */
  static changeOverWindow(points: PricePoint[], windowMs: number, nowMs: number): number | null {
    if (points.length === 0) return null;
    const oldest = points[0];
    const latest = points[points.length - 1];
    if (nowMs - oldest.timestampMs < windowMs) return null;

    const baseline = points.find((p) => p.timestampMs >= nowMs - windowMs);
    if (!baseline) return null;
    return this.changePct(baseline.priceUsdc, latest.priceUsdc);
  }

  /**
   * Collapse raw points into hourly closes (last price of each hour bucket),
   * ascending by time. Points are assumed sorted ascending.
   */
  static hourlyCloses(points: PricePoint[]): number[] {
    const byHour = new Map<number, number>();
    for (const p of points) {
      byHour.set(Math.floor(p.timestampMs / HOUR_MS), p.priceUsdc);
    }
    return [...byHour.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, price]) => price);
  }

  /**
   * RSI with Wilder smoothing over a series of closes.
   * Returns null when there are fewer than `period + 1` closes.
   */
  static rsi(closes: number[], period: number): number | null {
    if (closes.length < period + 1) return null;

    // Initial averages over the first `period` deltas
    let avgGain = toDecimal(0);
    let avgLoss = toDecimal(0);
    for (let i = 1; i <= period; i++) {
      const delta = toDecimal(closes[i]).minus(closes[i - 1]);
      if (delta.gte(0)) {
        avgGain = avgGain.plus(delta);
      } else {
        avgLoss = avgLoss.plus(delta.abs());
      }
    }
    avgGain = avgGain.div(period);
    avgLoss = avgLoss.div(period);

    // Wilder smoothing over the rest of the series
    for (let i = period + 1; i < closes.length; i++) {
      const delta = toDecimal(closes[i]).minus(closes[i - 1]);
      const gain = delta.gt(0) ? delta : toDecimal(0);
      const loss = delta.lt(0) ? delta.abs() : toDecimal(0);
      avgGain = avgGain.times(period - 1).plus(gain).div(period);
      avgLoss = avgLoss.times(period - 1).plus(loss).div(period);
    }

    if (avgLoss.isZero()) return 100;
    const rs = avgGain.div(avgLoss);
    return toDecimal(100).minus(toDecimal(100).div(rs.plus(1))).toNumber();
  }
}
