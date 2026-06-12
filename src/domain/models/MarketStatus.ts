/**
 * MarketStatus - live market snapshot for on-demand checks
 */

import type { AssetMarketStats } from "./MarketDigest.js";
import type { MarketSignal } from "./MarketSignal.js";

export interface MarketStatus {
  assets: AssetMarketStats[];
  /** Signals whose conditions hold right now (cooldowns are not consulted) */
  activeSignals: MarketSignal[];
  generatedAtMs: number;
}
