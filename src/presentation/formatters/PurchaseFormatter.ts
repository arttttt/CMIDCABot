/**
 * Purchase formatter - domain objects to UI response
 */

import { PurchaseResult } from "../../domain/usecases/types.js";
import { UIResponse } from "../protocol/types.js";

export class PurchaseFormatter {
  format(result: PurchaseResult): UIResponse {
    switch (result.type) {
      case "unavailable":
        return {
          text: "Portfolio purchases are not available. JUPITER_API_KEY is required.",
        };

      case "invalid_amount":
        return {
          text: result.error
            ? `Invalid amount: ${result.error}`
            : "Invalid amount. Please provide a positive number.\n\nExample: /portfolio buy 10",
        };

      case "no_wallet":
        return {
          text:
            "No wallet connected.\n\n" +
            "Use /wallet create to create a new wallet first.",
        };

      case "insufficient_balance":
        return {
          text:
            `Insufficient USDC balance.\n\n` +
            `Required: ${result.requiredBalance} USDC\n` +
            `Available: ${result.availableBalance?.toFixed(2) ?? "0"} USDC`,
        };

      case "quote_error":
        return {
          text: `Failed to get quote: ${result.error}`,
        };

      case "build_error":
        return {
          text: `Failed to build transaction: ${result.error}`,
        };

      case "send_error":
        return {
          text: `Transaction failed: ${result.error}`,
        };

      case "success": {
        const confirmStatus = result.confirmed ? "Confirmed" : "Pending";
        const explorerUrl = `https://solscan.io/tx/${result.signature}`;

        return {
          text:
            `Purchase Complete\n` +
            `${"─".repeat(25)}\n\n` +
            `Asset: ${result.asset}\n` +
            `Amount: ${result.amountAsset!.toFixed(8)} ${result.asset}\n` +
            `Cost: ${result.amountUsdc} USDC\n` +
            `Price: $${result.priceUsd!.toLocaleString()}\n\n` +
            `Status: ${confirmStatus}\n` +
            `[View on Solscan](${explorerUrl})\n\n` +
            `Use /portfolio to see your updated portfolio.`,
        };
      }

      default:
        return { text: "Unable to execute purchase." };
    }
  }

  formatUsage(): UIResponse {
    return {
      text:
        "Usage: /portfolio buy {amount}\n\n" +
        "Example: /portfolio buy 10\n\n" +
        "Purchases the asset furthest below target in the Crypto Majors Index.",
    };
  }
}
