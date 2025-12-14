/**
 * QuoteFormatter - Formats swap quote data for display
 */

import { GetQuoteResult } from "../../domain/usecases/GetQuoteUseCase.js";
import { UIResponse } from "../protocol/types.js";

export class QuoteFormatter {
  format(result: GetQuoteResult): UIResponse {
    if (result.status === "unavailable") {
      return { text: "❌ Quote service is not available (requires JUPITER_API_KEY)" };
    }

    if (result.status === "invalid_amount") {
      return { text: `❌ Invalid amount: ${result.message}` };
    }

    if (result.status === "invalid_asset") {
      return { text: `❌ Invalid asset: ${result.message}` };
    }

    if (result.status === "error") {
      return { text: `❌ Failed to get quote: ${result.message}` };
    }

    const { quote } = result;

    const pricePerUnit = quote.inputAmount / quote.outputAmount;
    const slippagePct = quote.slippageBps / 100;

    const lines = [
      "📊 *Swap Quote*",
      "",
      `*Spend:* ${this.formatAmount(quote.inputAmount)} ${quote.inputSymbol}`,
      `*Receive:* ${this.formatAmount(quote.outputAmount)} ${quote.outputSymbol}`,
      "",
      `*Price:* 1 ${quote.outputSymbol} = ${this.formatPrice(pricePerUnit)} USDC`,
      `*Min Receive:* ${this.formatAmount(quote.minOutputAmount)} ${quote.outputSymbol}`,
      "",
      `*Price Impact:* ${this.formatPercent(quote.priceImpactPct)}`,
      `*Slippage:* ${slippagePct}%`,
      "",
      `*Route:* ${quote.route.join(" → ") || "Direct"}`,
      "",
      `_Quote valid for ~30 seconds_`,
    ];

    return { text: lines.join("\n") };
  }

  formatUsage(): UIResponse {
    return {
      text: [
        "*Swap Quote*",
        "",
        "Get a swap quote without executing the trade.",
        "",
        "*Usage:* `/swap quote <usdc> [asset]`",
        "",
        "*Examples:*",
        "• `/swap quote 10` - quote SOL for 10 USDC",
        "• `/swap quote 10 BTC` - quote BTC for 10 USDC",
        "• `/swap quote 10 ETH` - quote ETH for 10 USDC",
        "",
        "*Supported assets:* BTC, ETH, SOL",
        "",
        "_This is a read-only operation, no funds are moved._",
      ].join("\n"),
    };
  }

  private formatAmount(amount: number): string {
    if (amount >= 1000) {
      return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (amount >= 1) {
      return amount.toFixed(4);
    }
    if (amount >= 0.0001) {
      return amount.toFixed(6);
    }
    return amount.toFixed(8);
  }

  private formatPrice(price: number): string {
    if (price >= 1000) {
      return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toFixed(2);
  }

  private formatPercent(pct: number): string {
    if (Math.abs(pct) < 0.01) {
      return "<0.01%";
    }
    return `${pct.toFixed(2)}%`;
  }
}
