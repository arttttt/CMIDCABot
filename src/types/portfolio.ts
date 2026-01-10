/**
 * Portfolio type definitions
 *
 * Defines the target asset allocations for the Crypto Majors Index.
 */

/**
 * Supported asset symbols for portfolio
 */
export type AssetSymbol = "BTC" | "ETH" | "SOL";

/**
 * Target allocations for Crypto Majors Index
 *
 * - SOL — 40%
 * - BTC (cbBTC) — 30%
 * - ETH (wETH) — 30%
 */
export const TARGET_ALLOCATIONS: Record<AssetSymbol, number> = {
  SOL: 0.4,
  BTC: 0.3,
  ETH: 0.3,
} as const;
