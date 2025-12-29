/**
 * QuoteFormatter - Formats swap quote data for display
 */

import { GetQuoteResult } from "../../domain/usecases/GetQuoteUseCase.js";
import { ClientResponse } from "../protocol/types.js";
import { Markdown } from "./markdown.js";

export class QuoteFormatter {
  format(result: GetQuoteResult): ClientResponse {
    if (result.status === "unavailable") {
      return new ClientResponse(`❌ Quote service is not available (requires ${Markdown.code("JUPITER_API_KEY")})`);
    }

    if (result.status === "invalid_amount") {
      return new ClientResponse(`❌ Invalid amount: ${Markdown.escape(result.message ?? "")}`);
    }

    if (result.status === "invalid_asset") {
      return new ClientResponse(`❌ Invalid asset: ${Markdown.escape(result.message ?? "")}`);
    }

    if (result.status === "error") {
      return new ClientResponse(`❌ Failed to get quote: ${Markdown.escape(result.message ?? "")}`);
    }

    const { quote } = result;

    const pricePerUnit = quote.inputAmount / quote.outputAmount;
    const slippagePct = quote.slippageBps / 100;

    const routeDisplay = quote.route.map((r) => Markdown.escape(r)).join(" → ") || "Direct";

    const lines = [
      "📊 *Swap Quote*",
      "",
      `*Spend:* ${this.formatAmount(quote.inputAmount)} ${Markdown.escape(quote.inputSymbol)}`,
      `*Receive:* ${this.formatAmount(quote.outputAmount)} ${Markdown.escape(quote.outputSymbol)}`,
      "",
      `*Price:* 1 ${Markdown.escape(quote.outputSymbol)} = ${this.formatPrice(pricePerUnit)} USDC`,
      `*Min Receive:* ${this.formatAmount(quote.minOutputAmount)} ${Markdown.escape(quote.outputSymbol)}`,
      "",
      `*Price Impact:* ${this.formatPercent(quote.priceImpactPct)}`,
      `*Slippage:* ${slippagePct}%`,
      "",
      `*Route:* ${routeDisplay}`,
      "",
      `_Quote valid for ~30 seconds_`,
    ];

    return new ClientResponse(lines.join("\n"));
  }

  formatUsage(): ClientResponse {
    return new ClientResponse(
      [
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
    );
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
