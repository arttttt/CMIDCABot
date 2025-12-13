/**
 * Price Service - Fetches real-time prices from Jupiter Price API v3
 * https://dev.jup.ag/docs/price
 *
 * Requires API key from https://portal.jup.ag (free Basic plan available)
 * Set JUPITER_API_KEY environment variable to use this service.
 */

import { AssetSymbol } from "../types/portfolio.js";

// Jupiter Price API v3 endpoint (requires API key from https://portal.jup.ag)
const JUPITER_PRICE_API = "https://api.jup.ag/price/v3";

// Token mint addresses on Solana mainnet
export const TOKEN_MINTS = {
  // Native SOL (Wrapped SOL)
  SOL: "So11111111111111111111111111111111111111112",
  // USDC (Circle)
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  // cbBTC (Coinbase Wrapped Bitcoin)
  BTC: "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij",
  // Wormhole Wrapped ETH
  ETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
} as const;

export interface JupiterPriceData {
  decimals: number;
  usdPrice: number;
  blockId?: number | null;
  priceChange24h?: number | null;
}

export interface JupiterPriceResponse {
  [mint: string]: JupiterPriceData;
}

export interface AssetPrices {
  BTC: number;
  ETH: number;
  SOL: number;
  fetchedAt: Date;
}

export class PriceService {
  private baseUrl: string;
  private apiKey: string;
  private cachedPrices: AssetPrices | null = null;
  private cacheMaxAgeMs: number;

  constructor(apiKey: string, baseUrl: string = JUPITER_PRICE_API, cacheMaxAgeMs: number = 60000) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.cacheMaxAgeMs = cacheMaxAgeMs; // Default: 1 minute cache
  }

  /**
   * Fetch current prices for all portfolio assets (BTC, ETH, SOL)
   * Returns prices in USD
   */
  async getPrices(): Promise<AssetPrices> {
    // Check cache
    if (this.cachedPrices && this.isCacheValid()) {
      return this.cachedPrices;
    }

    // Fetch fresh prices from Jupiter
    const mints = [TOKEN_MINTS.BTC, TOKEN_MINTS.ETH, TOKEN_MINTS.SOL];
    const url = `${this.baseUrl}?ids=${mints.join(",")}`;

    const response = await fetch(url, {
      headers: {
        "x-api-key": this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Jupiter Price API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as JupiterPriceResponse;

    // Parse prices from response
    const prices: AssetPrices = {
      BTC: data[TOKEN_MINTS.BTC]?.usdPrice ?? 0,
      ETH: data[TOKEN_MINTS.ETH]?.usdPrice ?? 0,
      SOL: data[TOKEN_MINTS.SOL]?.usdPrice ?? 0,
      fetchedAt: new Date(),
    };

    // Validate all prices were fetched
    if (prices.BTC === 0 || prices.ETH === 0 || prices.SOL === 0) {
      throw new Error("Failed to fetch some asset prices from Jupiter");
    }

    // Update cache
    this.cachedPrices = prices;

    return prices;
  }

  /**
   * Get price for a specific asset
   */
  async getPrice(symbol: AssetSymbol): Promise<number> {
    const prices = await this.getPrices();
    return prices[symbol];
  }

  /**
   * Get all prices as a simple record (compatible with MOCK_PRICES format)
   */
  async getPricesRecord(): Promise<Record<AssetSymbol, number>> {
    const prices = await this.getPrices();
    return {
      BTC: prices.BTC,
      ETH: prices.ETH,
      SOL: prices.SOL,
    };
  }

  /**
   * Clear the price cache (useful for testing or forcing refresh)
   */
  clearCache(): void {
    this.cachedPrices = null;
  }

  private isCacheValid(): boolean {
    if (!this.cachedPrices) return false;
    const age = Date.now() - this.cachedPrices.fetchedAt.getTime();
    return age < this.cacheMaxAgeMs;
  }
}
