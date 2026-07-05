/**
 * Asset discovery domain models
 *
 * Full picture of a wallet's holdings: liquid tokens (native SOL,
 * SPL, Token-2022) plus DeFi positions held inside protocols
 * (lending, staking, liquidity), which do not appear as token
 * accounts of the wallet.
 */

import type { WalletAddress } from "./id/index.js";

/**
 * Where a token balance lives
 */
export type TokenBalanceSource = "native" | "spl-token" | "spl-token-2022";

/**
 * A liquid token balance held directly by the wallet
 */
export interface TokenHolding {
  /** Base58 mint address; native SOL uses the WSOL mint for pricing */
  mint: string;
  /** Known asset symbol (e.g. "SOL"), if the mint is recognized */
  symbol?: string;
  /** Amount in human units */
  amount: number;
  decimals: number;
  source: TokenBalanceSource;
  /** USD price per unit; absent when no reliable price is available */
  usdPrice?: number;
  /** amount * usdPrice; absent when no reliable price is available */
  usdValue?: number;
}

/**
 * Kind of a DeFi position
 */
export type DefiPositionKind = "supplied" | "borrowed" | "staked" | "liquidity" | "rewards";

/**
 * A single asset inside a DeFi position
 */
export interface DefiPositionAsset {
  symbol?: string;
  mint?: string;
  /** Amount in human units */
  amount: number;
  usdValue?: number;
  /** Side of the asset inside the position; treated as supplied when omitted */
  role?: "supplied" | "borrowed";
}

/**
 * A wallet's position inside a DeFi protocol
 */
export interface DefiPosition {
  /** Platform id, e.g. "kamino" */
  platform: string;
  /** Human-readable label, e.g. "Lending" or "Multiply 2.4x" */
  label: string;
  kind: DefiPositionKind;
  assets: DefiPositionAsset[];
  /** Net USD value of the position, when the source provides it */
  usdValue?: number;
}

/**
 * Complete discovery result for a wallet
 */
export interface DiscoveredAssets {
  wallet: WalletAddress;
  /** Liquid tokens including the native SOL entry, sorted by USD value */
  tokens: TokenHolding[];
  positions: DefiPosition[];
  /** Position source ids that failed during discovery (result is partial) */
  failedSources: string[];
  /** Sum of all valued tokens and positions */
  totalUsdValue: number;
  fetchedAt: Date;
}
