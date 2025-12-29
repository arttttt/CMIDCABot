/**
 * Purchase formatter - domain objects to UI response
 */

import { PurchaseResult } from "../../domain/usecases/types.js";
import { ClientResponse } from "../protocol/types.js";
import { Markdown } from "./markdown.js";

export class PurchaseFormatter {
  format(result: PurchaseResult): ClientResponse {
    switch (result.type) {
      case "unavailable":
        return new ClientResponse(
          `Portfolio purchases are not available. ${Markdown.code("JUPITER_API_KEY")} is required.`,
        );

      case "invalid_amount":
        return new ClientResponse(
          result.error
            ? `Invalid amount: ${Markdown.escape(result.error)}`
            : "Invalid amount. Please provide a positive number.\n\nExample: /portfolio buy 10",
        );

      case "no_wallet":
        return new ClientResponse(
          "No wallet connected.\n\n" +
            "Use /wallet create to create a new wallet first.",
        );

      case "insufficient_balance":
        return new ClientResponse(
          `Insufficient USDC balance.\n\n` +
            `Required: ${result.requiredBalance} USDC\n` +
            `Available: ${result.availableBalance?.toFixed(2) ?? "0"} USDC`,
        );

      case "quote_error":
        return new ClientResponse(`Failed to get quote: ${Markdown.escape(result.error ?? "")}`);

      case "build_error":
        return new ClientResponse(`Failed to build transaction: ${Markdown.escape(result.error ?? "")}`);

      case "send_error": {
        const errorText = `Transaction failed: ${Markdown.escape(result.error ?? "")}`;
        if (result.signature) {
          const explorerUrl = `https://solscan.io/tx/${result.signature}`;
          return new ClientResponse(`${errorText}\n\n${Markdown.link("View on Solscan", explorerUrl)}`);
        }
        return new ClientResponse(errorText);
      }

      case "rpc_error":
        return new ClientResponse(
          "Failed to check balance. The Solana network may be busy.\n\n" +
            "Please try again in a few seconds.",
        );

      case "success": {
        const confirmStatus = result.confirmed ? "Confirmed" : "Confirmation timeout";
        const explorerUrl = `https://solscan.io/tx/${result.signature}`;

        return new ClientResponse(
          `Purchase Complete\n` +
            `${"─".repeat(25)}\n\n` +
            `Asset: ${Markdown.escape(result.asset ?? "")}\n` +
            `Amount: ${result.amountAsset!.toFixed(8)} ${Markdown.escape(result.asset ?? "")}\n` +
            `Cost: ${result.amountUsdc} USDC\n` +
            `Price: $${result.priceUsd!.toLocaleString()}\n\n` +
            `Status: ${confirmStatus}\n` +
            `${Markdown.link("View on Solscan", explorerUrl)}\n\n` +
            `Use /portfolio to see your updated portfolio.`,
        );
      }

      default:
        return new ClientResponse("Unable to execute purchase.");
    }
  }

  formatUsage(): ClientResponse {
    return new ClientResponse(
      "Usage: /portfolio buy {amount}\n\n" +
        "Example: /portfolio buy 10\n\n" +
        "Purchases the asset furthest below target in the Crypto Majors Index.",
    );
  }
}
