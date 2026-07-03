/**
 * MarketDigest - daily market statistics for the portfolio basket
 */

import type { AssetSymbol } from "../constants/portfolio.js";

export interface AssetMarketStats {
  symbol: AssetSymbol;
  price: number;
  /** Percent change over the last 24h, null when history is insufficient */
  change24hPct: number | null;
  /** Percent change over the last 7 days, null when history is insufficient */
  change7dPct: number | null;
  /** RSI over hourly closes, null when history is insufficient */
  rsi: number | null;
}

export interface MarketDigest {
  assets: AssetMarketStats[];
  generatedAtMs: number;
}
