/**
 * MarketSignal - a "good moment to buy" market condition detected by SignalPolicy
 */

import type { AssetSymbol } from "../../types/portfolio.js";

export type MarketSignalType = "dip24h" | "dip7d" | "rsiOversold";

/** Price dropped from the period high by more than the threshold */
export interface DipSignal {
  type: "dip24h" | "dip7d";
  symbol: AssetSymbol;
  currentPrice: number;
  periodHigh: number;
  /** Drawdown from periodHigh, positive percent (6.2 = price is 6.2% below high) */
  drawdownPct: number;
}

/** RSI dropped below the oversold threshold */
export interface RsiOversoldSignal {
  type: "rsiOversold";
  symbol: AssetSymbol;
  currentPrice: number;
  rsi: number;
}

export type MarketSignal = DipSignal | RsiOversoldSignal;
