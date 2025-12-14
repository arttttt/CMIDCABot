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
          text: "Mock purchases are not available in this mode.",
        };

      case "invalid_amount":
        return {
          text: "Invalid amount. Please provide a positive number.\n\nExample: /portfolio buy 0.5",
        };

      case "no_wallet":
        return {
          text:
            "No wallet connected.\n\n" +
            "Use /wallet set <address> to connect your Solana wallet first.",
        };

      case "insufficient_balance":
        return {
          text:
            `Insufficient SOL balance.\n\n` +
            `Required: ${result.requiredBalance} SOL\n` +
            `Available: ${result.availableBalance!.toFixed(4)} SOL`,
        };

      case "failed":
        return {
          text: `Purchase failed: ${result.error}`,
        };

      case "success":
        return {
          text:
            `Mock Purchase Complete\n` +
            `${"─".repeat(25)}\n\n` +
            `Asset: ${result.asset}\n` +
            `Amount: ${result.amountAsset!.toFixed(8)} ${result.asset}\n` +
            `Cost: ${result.amountSol} SOL\n` +
            `Value: $${result.valueUsd!.toFixed(2)}\n` +
            `Price: $${result.priceUsd!.toLocaleString()}\n\n` +
            `Note: This is a mock purchase. No real tokens were swapped.\n` +
            `Your SOL balance was checked but not deducted.\n\n` +
            `Use /portfolio to see your portfolio.`,
        };

      default:
        return { text: "Unable to execute purchase." };
    }
  }

  formatUsage(): UIResponse {
    return {
      text:
        "Usage: /portfolio buy <amount_in_sol>\n\n" +
        "Example: /portfolio buy 0.5\n\n" +
        "This will mock-purchase the asset furthest below its target allocation.",
    };
  }
}
