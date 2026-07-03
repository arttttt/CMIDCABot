/**
 * GetPricesUseCase - Fetches current asset prices
 * Dev-only use case for debugging and monitoring
 */

import { PriceRepository } from "../repositories/PriceRepository.js";
import { AssetSymbol } from "../constants/portfolio.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export interface PriceInfo {
  symbol: AssetSymbol;
  priceUsd: number;
}

export type GetPricesResult =
  | { status: "success"; prices: PriceInfo[]; fetchedAt: Date }
  | { status: "error"; message: string };

export class GetPricesUseCase {
  constructor(private priceRepository: PriceRepository) {}

  async execute(): Promise<GetPricesResult> {
    logger.info("GetPrices", "Fetching current prices");

    try {
      const pricesRecord = await this.priceRepository.getPricesRecord();

      const prices: PriceInfo[] = [
        { symbol: "BTC", priceUsd: pricesRecord.BTC },
        { symbol: "ETH", priceUsd: pricesRecord.ETH },
        { symbol: "SOL", priceUsd: pricesRecord.SOL },
      ];

      logger.debug("GetPrices", "Prices fetched", {
        BTC: pricesRecord.BTC,
        ETH: pricesRecord.ETH,
        SOL: pricesRecord.SOL,
      });

      return {
        status: "success",
        prices,
        fetchedAt: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("GetPrices", "Failed to fetch prices", { error: message });
      return { status: "error", message };
    }
  }
}
