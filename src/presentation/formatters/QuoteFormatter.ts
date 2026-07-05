/**
 * QuoteFormatter - Formats swap quote data for display
 */

import { GetQuoteResult } from "../../domain/usecases/GetQuoteUseCase.js";
import { ClientResponse } from "../protocol/types.js";
import { Markdown } from "./markdown.js";
import { NumberFormatter } from "./NumberFormatter.js";

export class QuoteFormatter {
  format(result: GetQuoteResult): ClientResponse {
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
      `*Spend:* ${NumberFormatter.formatAmount(quote.inputAmount)} ${Markdown.escape(quote.inputSymbol)}`,
      `*Receive:* ${NumberFormatter.formatAmount(quote.outputAmount)} ${Markdown.escape(quote.outputSymbol)}`,
      "",
      `*Price:* 1 ${Markdown.escape(quote.outputSymbol)} = ${NumberFormatter.formatPrice(pricePerUnit)} USDC`,
      `*Min Receive:* ${NumberFormatter.formatAmount(quote.minOutputAmount)} ${Markdown.escape(quote.outputSymbol)}`,
      "",
      `*Price Impact:* ${NumberFormatter.formatPercent(quote.priceImpactPct)}`,
      `*Slippage:* ${slippagePct}%`,
      "",
      `*Route:* ${routeDisplay}`,
      "",
      `_Quote valid for ~30 seconds_`,
    ];

    return ClientResponse.sensitive(lines.join("\n"));
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
}
