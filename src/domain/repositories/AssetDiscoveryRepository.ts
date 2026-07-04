/**
 * Asset Discovery Repository Interface
 *
 * Port for discovering everything a wallet holds: liquid token
 * balances plus DeFi positions across supported protocols.
 * Implementations aggregate multiple sources; a failing position
 * source must not fail the whole discovery — it is reported in
 * failedSources instead.
 */

import type { WalletAddress } from "../models/id/index.js";
import type { TokenHolding, DefiPosition } from "../models/DiscoveredAssets.js";

/**
 * Raw discovery output: holdings without price enrichment.
 * Positions may carry USD values when the source provides them.
 */
export interface DiscoveredRawAssets {
  tokens: TokenHolding[];
  positions: DefiPosition[];
  failedSources: string[];
}

export interface AssetDiscoveryRepository {
  /**
   * Discover all assets held by a wallet.
   * @throws Error when base token discovery fails entirely
   */
  discover(walletAddress: WalletAddress): Promise<DiscoveredRawAssets>;
}
