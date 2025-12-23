/**
 * Jupiter Price Client - Fetches real-time prices from Jupiter Price API v3
 * https://dev.jup.ag/docs/price
 *
 * Requires API key from https://portal.jup.ag (free Basic plan available)
 * Set JUPITER_API_KEY environment variable to use this service.
 */

import { AssetSymbol } from "../../../types/portfolio.js";
import { logger } from "../../../infrastructure/shared/logging/index.js";

// Jupiter Price API v3 endpoint (requires API key from https://portal.jup.ag)
const JUPITER_PRICE_API = "https://api.jup.ag/price/v3";

/**
 * Token mint addresses on Solana mainnet
 *
 * IMPORTANT: SOL vs WSOL clarification
 * ------------------------------------
 * The "SOL" key below stores the WSOL (Wrapped SOL) mint address, also known as NATIVE_MINT.
 * This is intentional because:
 *
 * 1. DEX APIs (Jupiter, Raydium, Orca) require the WSOL mint for swap routing
 * 2. Price APIs (Jupiter Price API) use the WSOL mint to identify SOL
 * 3. Jupiter Swap API automatically handles wrap/unwrap when wrapAndUnwrapSol=true (default)
 *
 * Native SOL (lamports) vs WSOL (SPL token):
 * - Native SOL: Stored in account.balance, used for transaction fees
 * - WSOL: SPL token with this mint, needed for DEX swaps
 *
 * In our code:
 * - SolanaRpcClient.getBalance() returns NATIVE SOL balance (lamports)
 * - TOKEN_MINTS.SOL is used only for Jupiter API calls (prices, quotes, swaps)
 * - Jupiter handles wrap/unwrap automatically — we don't manage WSOL accounts manually
 *
 * See: https://spl.solana.com/token#wrapping-sol
 */
export const TOKEN_MINTS = {
  /**
   * Wrapped SOL (WSOL) mint address - used for DEX/price APIs
   * This is the NATIVE_MINT from @solana/spl-token
   */
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

export class JupiterPriceClient {
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
      logger.debug("JupiterPriceClient", "Using cached prices");
      return this.cachedPrices;
    }

    // Fetch fresh prices from Jupiter
    const mints = [TOKEN_MINTS.BTC, TOKEN_MINTS.ETH, TOKEN_MINTS.SOL];
    const url = `${this.baseUrl}?ids=${mints.join(",")}`;

    logger.debug("JupiterPriceClient", "Fetching prices from Jupiter");
    const response = await fetch(url, {
      headers: {
        "x-api-key": this.apiKey,
      },
    });

    if (!response.ok) {
      logger.error("JupiterPriceClient", "Jupiter API error", {
        status: response.status,
        statusText: response.statusText,
      });
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
      logger.error("JupiterPriceClient", "Failed to fetch some asset prices");
      throw new Error("Failed to fetch some asset prices from Jupiter");
    }

    logger.debug("JupiterPriceClient", "Prices fetched", {
      BTC: prices.BTC,
      ETH: prices.ETH,
      SOL: prices.SOL,
    });

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
