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
 * - BTC (cbBTC) — 40%
 * - ETH (wETH) — 30%
 * - SOL — 30%
 */
export const TARGET_ALLOCATIONS: Record<AssetSymbol, number> = {
  BTC: 0.4,
  ETH: 0.3,
  SOL: 0.3,
} as const;
