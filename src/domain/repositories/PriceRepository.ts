/**
 * Price Repository Interface
 *
 * Port for fetching asset prices (Dependency Inversion).
 * Abstracts price source (Jupiter, mock, etc.) from domain layer.
 */

import type { AssetSymbol } from "../constants/portfolio.js";

/**
 * Asset prices in USD
 */
export interface AssetPrices {
  BTC: number;
  ETH: number;
  SOL: number;
  fetchedAt: Date;
}

/**
 * Port for fetching asset prices.
 * Domain layer depends on this interface, not on the concrete Jupiter implementation.
 */
export interface PriceRepository {
  /**
   * Fetch current prices for all portfolio assets (BTC, ETH, SOL)
   * Returns prices in USD
   */
  getPrices(): Promise<AssetPrices>;

  /**
   * Get price for a specific asset
   */
  getPrice(symbol: AssetSymbol): Promise<number>;

  /**
   * Get all prices as a simple record
   * Convenient for use cases that need just the numbers
   */
  getPricesRecord(): Promise<Record<AssetSymbol, number>>;

  /**
   * Clear price cache (if any)
   */
  clearCache(): void;
}
