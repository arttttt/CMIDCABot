/**
 * SwapFormatter - Formats swap execution results for display
 */

import { SwapResult } from "../../domain/models/SwapStep.js";
import { ClientResponse } from "../protocol/types.js";
import { Markdown } from "./markdown.js";

export class SwapFormatter {
  format(result: SwapResult): ClientResponse {
    if (result.status === "unavailable") {
      return new ClientResponse(`Swap unavailable (requires ${Markdown.code("JUPITER_API_KEY")})`);
    }

    if (result.status === "no_wallet") {
      return new ClientResponse(`No wallet found. Create one with ${Markdown.code("/wallet create")}`);
    }

    if (result.status === "insufficient_usdc_balance") {
      return new ClientResponse(
        `Insufficient USDC balance.\nRequired: ${result.required} USDC\nAvailable: ${result.available} USDC`,
      );
    }

    if (result.status === "invalid_amount") {
      return new ClientResponse(`Invalid amount: ${Markdown.escape(result.message ?? "")}`);
    }

    if (result.status === "invalid_asset") {
      return new ClientResponse(`Invalid asset: ${Markdown.escape(result.message ?? "")}`);
    }

    if (result.status === "quote_error") {
      return new ClientResponse(`Failed to get quote: ${Markdown.escape(result.message ?? "")}`);
    }

    if (result.status === "build_error") {
      return new ClientResponse(`Failed to build transaction: ${Markdown.escape(result.message ?? "")}`);
    }

    if (result.status === "send_error") {
      return new ClientResponse(`Transaction failed: ${Markdown.escape(result.message ?? "")}`);
    }

    if (result.status === "rpc_error") {
      return new ClientResponse(
        "Failed to check balance. The Solana network may be busy.\n\n" +
          "Please try again in a few seconds.",
      );
    }

    const { quote, signature, confirmed } = result;
    const sigStr = signature.value;

    const statusIcon = confirmed ? "CONFIRMED" : "PENDING";
    const pricePerUnit = quote.inputAmount / quote.outputAmount;

    const lines = [
      `*Swap ${statusIcon}*`,
      "",
      "*Trade:*",
      `  Spent: ${this.formatAmount(quote.inputAmount)} ${Markdown.escape(quote.inputSymbol)}`,
      `  Received: ${this.formatAmount(quote.outputAmount)} ${Markdown.escape(quote.outputSymbol)}`,
      `  Price: 1 ${Markdown.escape(quote.outputSymbol)} = ${this.formatPrice(pricePerUnit)} USDC`,
      "",
      "*Transaction:*",
      `  Signature: ${Markdown.code(this.truncateSignature(sigStr))}`,
      `  Status: ${confirmed ? "Confirmed" : "Pending confirmation..."}`,
      "",
      Markdown.link("View on Solscan", `https://solscan.io/tx/${sigStr}`),
    ];

    return new ClientResponse(lines.join("\n"));
  }

  formatUsage(): ClientResponse {
    return new ClientResponse(
      [
        "*Swap Execute*",
        "",
        "Execute a real swap on Solana mainnet.",
        "",
        "*Usage:* `/swap execute <usdc> [asset]`",
        "",
        "*Examples:*",
        "  `/swap execute 1` - swap 1 USDC for SOL",
        "  `/swap execute 5 BTC` - swap 5 USDC for BTC",
        "",
        "*WARNING:* This executes a REAL transaction!",
        "Use `/swap simulate` first to test.",
      ].join("\n"),
    );
  }

  formatUnifiedUsage(): ClientResponse {
    return new ClientResponse(
      [
        "*Swap Command*",
        "",
        "Manage swaps on Solana mainnet via Jupiter.",
        "",
        "*Subcommands:*",
        "",
        "`/swap quote <usdc> [asset]`",
        "  Get swap quote (read-only)",
        "",
        "`/swap simulate <usdc> [asset]`",
        "  Simulate swap transaction",
        "",
        "`/swap execute <usdc> [asset]`",
        "  Execute real swap (spends funds!)",
        "",
        "*Supported assets:* BTC, ETH, SOL (default)",
        "",
        "*Examples:*",
        "  `/swap quote 10` - quote 10 USDC → SOL",
        "  `/swap simulate 5 ETH` - simulate 5 USDC → ETH",
        "  `/swap execute 1 BTC` - execute 1 USDC → BTC",
      ].join("\n"),
    );
  }

  private formatAmount(amount: number): string {
    if (amount >= 1000) {
      return amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
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
      return price.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return price.toFixed(2);
  }

  private truncateSignature(signature: string): string {
    if (signature.length <= 20) {
      return signature;
    }
    return `${signature.slice(0, 8)}...${signature.slice(-8)}`;
  }
}
