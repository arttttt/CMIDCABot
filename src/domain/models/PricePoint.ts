/**
 * PricePoint - a single price observation for a portfolio asset
 */

import type { AssetSymbol } from "../constants/portfolio.js";

/** Where the observation came from: live polling or historical backfill */
export type PricePointSource = "live" | "backfill";

export interface PricePoint {
  symbol: AssetSymbol;
  priceUsdc: number;
  timestampMs: number;
  source: PricePointSource;
}
