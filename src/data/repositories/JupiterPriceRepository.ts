/**
 * Jupiter Price Repository Implementation
 *
 * Implements PriceRepository interface using JupiterPriceClient.
 * Provides Dependency Inversion for domain layer.
 */

import type {
  PriceRepository,
  AssetPrices,
} from "../../domain/repositories/PriceRepository.js";
import type { AssetSymbol } from "../../domain/constants/portfolio.js";
import type { JupiterPriceClient } from "../sources/api/JupiterPriceClient.js";

export class JupiterPriceRepository implements PriceRepository {
  constructor(private client: JupiterPriceClient) {}

  async getPrices(): Promise<AssetPrices> {
    return this.client.getPrices();
  }

  async getPrice(symbol: AssetSymbol): Promise<number> {
    return this.client.getPrice(symbol);
  }

  async getPricesRecord(): Promise<Record<AssetSymbol, number>> {
    return this.client.getPricesRecord();
  }
}
