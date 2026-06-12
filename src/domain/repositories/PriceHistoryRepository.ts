/**
 * PriceHistoryRepository - port for storing and reading collected price history
 */

import type { AssetSymbol } from "../../types/portfolio.js";
import type { PricePoint } from "../models/PricePoint.js";

export interface PriceHistoryRepository {
  /**
   * Persist price points (append-only).
   */
  saveAll(points: PricePoint[]): Promise<void>;

  /**
   * Price points for an asset since `fromMs`, ascending by timestamp.
   */
  getHistorySince(symbol: AssetSymbol, fromMs: number): Promise<PricePoint[]>;

  /**
   * Timestamp of the newest stored point for an asset, or null when empty.
   */
  getLatestTimestamp(symbol: AssetSymbol): Promise<number | null>;

  /**
   * Delete points older than the retention window.
   * Compatible with CleanupScheduler's CleanableStore.
   *
   * @returns number of deleted rows
   */
  deleteExpired(): Promise<number>;
}
