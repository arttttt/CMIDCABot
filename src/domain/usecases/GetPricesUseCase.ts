/**
 * GetPricesUseCase - Fetches current asset prices
 * Dev-only use case for debugging and monitoring
 */

import { PriceRepository, PriceSource } from "../repositories/PriceRepository.js";
import { AssetSymbol } from "../../types/portfolio.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export interface PriceInfo {
  symbol: AssetSymbol;
  priceUsd: number;
}

export type GetPricesResult =
  | { status: "success"; prices: PriceInfo[]; source: PriceSource; fetchedAt: Date }
  | { status: "unavailable" }
  | { status: "error"; message: string };

export class GetPricesUseCase {
  constructor(private priceRepository: PriceRepository | undefined) {}

  async execute(): Promise<GetPricesResult> {
    logger.info("GetPrices", "Fetching current prices");

    if (!this.priceRepository) {
      logger.warn("GetPrices", "Price repository unavailable");
      return { status: "unavailable" };
    }

    try {
      const pricesRecord = await this.priceRepository.getPricesRecord();
      const source = this.priceRepository.getPriceSource();

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
