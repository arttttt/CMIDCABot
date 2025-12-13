/**
 * Jupiter Price Service - Fetches real-time prices from Jupiter Price API v2
 * https://station.jup.ag/docs/apis/price-api-v2
 */

import { AssetSymbol } from "../types/portfolio.js";

// Jupiter Price API v2
const JUPITER_PRICE_API = "https://api.jup.ag/price/v2";

// Token mint addresses on Solana mainnet
export const TOKEN_MINTS = {
  // Native SOL (Wrapped SOL)
  SOL: "So11111111111111111111111111111111111111112",
  // USDC (Circle)
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  // cbBTC (Coinbase Wrapped Bitcoin)
  BTC: "cbBTCn3BWKsb4yjBQ6bBKwKECvG28mkoGd17bqkbePJS",
  // Wormhole Wrapped ETH
  ETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
} as const;

export interface TokenPrice {
  id: string;
  type: string;
  price: string;
}

export interface PriceApiResponse {
  data: Record<string, TokenPrice>;
  timeTaken: number;
}

export interface AssetPrices {
  BTC: number;
  ETH: number;
  SOL: number;
  fetchedAt: Date;
}

export class PriceService {
  private baseUrl: string;
  private cachedPrices: AssetPrices | null = null;
  private cacheMaxAgeMs: number;

  constructor(baseUrl: string = JUPITER_PRICE_API, cacheMaxAgeMs: number = 60000) {
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
    const url = new URL(this.baseUrl);
    url.searchParams.set("ids", mints.join(","));

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Jupiter Price API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as PriceApiResponse;

    // Parse prices from response
    const prices: AssetPrices = {
      BTC: this.parsePrice(data, TOKEN_MINTS.BTC),
      ETH: this.parsePrice(data, TOKEN_MINTS.ETH),
      SOL: this.parsePrice(data, TOKEN_MINTS.SOL),
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

  private parsePrice(data: PriceApiResponse, mint: string): number {
    const tokenData = data.data[mint];
    if (!tokenData?.price) {
      console.warn(`[PriceService] No price data for mint: ${mint}`);
      return 0;
    }
    return parseFloat(tokenData.price);
  }

  private isCacheValid(): boolean {
    if (!this.cachedPrices) return false;
    const age = Date.now() - this.cachedPrices.fetchedAt.getTime();
    return age < this.cacheMaxAgeMs;
  }
}
