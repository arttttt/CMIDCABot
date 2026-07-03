/**
 * Binance Klines Client - fetches historical hourly candles from Binance public API
 * https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints
 *
 * No API key required for market data. Used only for one-time price history
 * backfill on cold start; not a live price source (the project is Jupiter-only
 * for live prices and swaps).
 */

import { AssetSymbol } from "../../../domain/constants/portfolio.js";
import { logger } from "../../../infrastructure/shared/logging/index.js";

const BINANCE_API = "https://api.binance.com/api/v3";

/** Binance pairs equivalent to portfolio assets (cbBTC≈BTC, wETH=ETH for indicators) */
const BINANCE_PAIRS: Record<AssetSymbol, string> = {
  SOL: "SOLUSDC",
  BTC: "BTCUSDC",
  ETH: "ETHUSDC",
};

/** Binance returns max 1000 candles per request */
const MAX_KLINES_LIMIT = 1000;

/** Kline array: [openTime, open, high, low, close, volume, closeTime, ...] */
type BinanceKline = [number, string, string, string, string, string, number, ...unknown[]];

export interface HourlyCandle {
  closeTimeMs: number;
  closePrice: number;
}

export class BinanceKlinesClient {
  constructor(private baseUrl: string = BINANCE_API) {}

  /**
   * Fetch hourly candles for the last `hours` hours, ascending by close time.
   * Unfinished (still open) candles are excluded.
   */
  async getHourlyCandles(symbol: AssetSymbol, hours: number): Promise<HourlyCandle[]> {
    const limit = Math.min(hours, MAX_KLINES_LIMIT);
    const url = `${this.baseUrl}/klines?symbol=${BINANCE_PAIRS[symbol]}&interval=1h&limit=${limit}`;

    logger.debug("BinanceKlinesClient", "Fetching klines", { symbol, hours: limit });
    const response = await fetch(url);

    if (!response.ok) {
      logger.error("BinanceKlinesClient", "Binance API error", {
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`Binance klines API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as BinanceKline[];
    const nowMs = Date.now();

    return data
      .filter((k) => k[6] <= nowMs)
      .map((k) => ({
        closeTimeMs: k[6],
        closePrice: Number(k[4]),
      }));
  }
}
