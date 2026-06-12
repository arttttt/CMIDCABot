/**
 * PriceFormatter - Formats price data for display
 */

import { GetPricesResult } from "../../domain/usecases/GetPricesUseCase.js";
import { ClientResponse } from "../protocol/types.js";
import { Markdown } from "./markdown.js";

export class PriceFormatter {
  format(result: GetPricesResult): ClientResponse {
    if (result.status === "error") {
      return new ClientResponse(`❌ Failed to fetch prices: ${Markdown.escape(result.message ?? "")}`);
    }

    const { prices, fetchedAt } = result;

    const timeStr = fetchedAt.toLocaleTimeString();

    const lines = [
      "💰 *Current Prices*",
      "",
      ...prices.map((p) => `• *${Markdown.escape(p.symbol)}*: $${this.formatPrice(p.priceUsd)}`),
      "",
      `Updated: ${timeStr}`,
    ];

    return new ClientResponse(lines.join("\n"));
  }

  private formatPrice(price: number): string {
    if (price >= 1000) {
      return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toFixed(2);
  }
}
