/**
 * MarketFormatter - formats market signals and digest for display
 */

import type { MarketSignal } from "../../domain/models/MarketSignal.js";
import type { AssetMarketStats, MarketDigest } from "../../domain/models/MarketDigest.js";
import type { GetMarketStatusResult } from "../../domain/usecases/GetMarketStatusUseCase.js";
import { ClientResponse } from "../protocol/types.js";
import { NumberFormatter } from "./NumberFormatter.js";

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
      lines.push(this.formatAssetLine(asset));
    }

    return new ClientResponse(lines.join("\n"));
  }

  /**
   * Format the on-demand market status (/market command)
   */
  formatStatus(result: GetMarketStatusResult): ClientResponse {
    if (result.status === "error") {
      return new ClientResponse(`❌ Failed to fetch market status: ${result.message}`);
    }

    const { assets, activeSignals } = result.market;
    const lines = ["📈 *Market status*", ""];

    for (const asset of assets) {
      lines.push(this.formatAssetLine(asset));
    }

    if (assets.some((a) => a.change24hPct === null || a.change7dPct === null || a.rsi === null)) {
      lines.push("");
      lines.push("_Some stats are still collecting history._");
    }

    lines.push("");
    if (activeSignals.length > 0) {
      lines.push("🔔 *Active signals:*");
      for (const signal of activeSignals) {
        lines.push(this.formatSignalLine(signal));
      }
    } else {
      lines.push("No active buy signals.");
    }

    return new ClientResponse(lines.join("\n"));
  }

  private formatAssetLine(asset: AssetMarketStats): string {
    const parts = [`• *${asset.symbol}*: $${NumberFormatter.formatPrice(asset.price)}`];
    if (asset.change24hPct !== null) parts.push(`24h ${this.formatChange(asset.change24hPct)}`);
    if (asset.change7dPct !== null) parts.push(`7d ${this.formatChange(asset.change7dPct)}`);
    if (asset.rsi !== null) parts.push(`RSI ${asset.rsi.toFixed(0)}`);
    return parts.join(" | ");
  }

  private formatSignalLine(signal: MarketSignal): string {
    switch (signal.type) {
      case "dip24h":
        return `• *${signal.symbol}* is ${signal.drawdownPct.toFixed(1)}% below its 24h high ($${NumberFormatter.formatPrice(signal.periodHigh)} → $${NumberFormatter.formatPrice(signal.currentPrice)})`;
      case "dip7d":
        return `• *${signal.symbol}* is ${signal.drawdownPct.toFixed(1)}% below its 7d high ($${NumberFormatter.formatPrice(signal.periodHigh)} → $${NumberFormatter.formatPrice(signal.currentPrice)})`;
      case "rsiOversold":
        return `• *${signal.symbol}* RSI is ${signal.rsi.toFixed(0)} (oversold) at $${NumberFormatter.formatPrice(signal.currentPrice)}`;
    }
  }

  private formatChange(pct: number): string {
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
  }
}
