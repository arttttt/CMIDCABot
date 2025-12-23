/**
 * Portfolio domain types
 *
 * These types define portfolio allocation and status structures
 * used across domain layer use cases.
 */

import { AssetSymbol } from "../../types/portfolio.js";

/**
 * Asset allocation information
 */
export interface AllocationInfo {
  symbol: AssetSymbol;
  balance: number;
  valueInUsdc: number;
  currentAllocation: number;
  targetAllocation: number;
  /** Negative = below target (needs buying), Positive = above target (overweight) */
  deviation: number;
}

/**
 * Portfolio status with allocations and recommendations
 */
export interface PortfolioStatus {
  allocations: AllocationInfo[];
  totalValueInUsdc: number;
  /** Asset recommended for next purchase (most underweight) */
  assetToBuy: AssetSymbol;
  /** Maximum negative deviation from target allocation */
  maxDeviation: number;
}
