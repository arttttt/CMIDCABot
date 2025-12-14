/**
 * GetPricesUseCase - Fetches current asset prices
 * Dev-only use case for debugging and monitoring
 */

import { DcaService } from "../../services/dca.js";
import { AssetSymbol } from "../../types/portfolio.js";
import { PriceSource } from "../../types/config.js";
import { logger } from "../../services/logger.js";

export interface PriceInfo {
  symbol: AssetSymbol;
  priceUsd: number;
}

export type GetPricesResult =
  | { status: "success"; prices: PriceInfo[]; source: PriceSource; fetchedAt: Date }
  | { status: "unavailable" }
  | { status: "error"; message: string };

export class GetPricesUseCase {
  constructor(private dca: DcaService | undefined) {}

  async execute(): Promise<GetPricesResult> {
    logger.info("GetPrices", "Fetching current prices");

    if (!this.dca) {
      logger.warn("GetPrices", "DCA service unavailable");
      return { status: "unavailable" };
    }

    try {
      const pricesRecord = await this.dca.getCurrentPrices();
      const source = this.dca.getPriceSource();

      const prices: PriceInfo[] = [
        { symbol: "BTC", priceUsd: pricesRecord.BTC },
        { symbol: "ETH", priceUsd: pricesRecord.ETH },
        { symbol: "SOL", priceUsd: pricesRecord.SOL },
      ];

      logger.debug("GetPrices", "Prices fetched", {
        source,
        BTC: pricesRecord.BTC,
        ETH: pricesRecord.ETH,
        SOL: pricesRecord.SOL,
      });

      return {
        status: "success",
        prices,
        source,
        fetchedAt: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("GetPrices", "Failed to fetch prices", { error: message });
      return { status: "error", message };
    }
  }
}
