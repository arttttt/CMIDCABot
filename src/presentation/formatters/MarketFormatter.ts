/**
 * MarketFormatter - formats market signals and digest for display
 */

import type { MarketSignal } from "../../domain/models/MarketSignal.js";
import type { MarketDigest } from "../../domain/models/MarketDigest.js";
import { ClientResponse } from "../protocol/types.js";

export class MarketFormatter {
  /**
   * Format fired signals as a single notification message
   */
  formatSignals(signals: MarketSignal[]): ClientResponse {
    const lines = ["📉 *Buy opportunity*", ""];

    for (const signal of signals) {
      lines.push(this.formatSignalLine(signal));
    }

    lines.push("");
    lines.push("Use /portfolio to check allocations and buy.");

    return new ClientResponse(lines.join("\n"));
  }

  /**
   * Format the daily market digest
   */
  formatDigest(digest: MarketDigest): ClientResponse {
    const lines = ["📊 *Daily market digest*", ""];

    for (const asset of digest.assets) {
      const parts = [`• *${asset.symbol}*: $${this.formatPrice(asset.price)}`];
      if (asset.change24hPct !== null) parts.push(`24h ${this.formatChange(asset.change24hPct)}`);
      if (asset.change7dPct !== null) parts.push(`7d ${this.formatChange(asset.change7dPct)}`);
      if (asset.rsi !== null) parts.push(`RSI ${asset.rsi.toFixed(0)}`);
      lines.push(parts.join(" | "));
    }

    return new ClientResponse(lines.join("\n"));
  }

  private formatSignalLine(signal: MarketSignal): string {
    switch (signal.type) {
      case "dip24h":
        return `• *${signal.symbol}* is ${signal.drawdownPct.toFixed(1)}% below its 24h high ($${this.formatPrice(signal.periodHigh)} → $${this.formatPrice(signal.currentPrice)})`;
      case "dip7d":
        return `• *${signal.symbol}* is ${signal.drawdownPct.toFixed(1)}% below its 7d high ($${this.formatPrice(signal.periodHigh)} → $${this.formatPrice(signal.currentPrice)})`;
      case "rsiOversold":
        return `• *${signal.symbol}* RSI is ${signal.rsi.toFixed(0)} (oversold) at $${this.formatPrice(signal.currentPrice)}`;
    }
  }

  private formatPrice(price: number): string {
    if (price >= 1000) {
      return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toFixed(2);
  }

  private formatChange(pct: number): string {
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
  }
}
