/**
 * Portfolio formatter - domain objects to UI response
 */

import { PortfolioStatusResult, ResetResult } from "../../domain/usecases/types.js";
import { TARGET_ALLOCATIONS } from "../../types/portfolio.js";
import { UIResponse } from "../protocol/types.js";

export class PortfolioFormatter {
  formatStatus(result: PortfolioStatusResult): UIResponse {
    switch (result.type) {
      case "unavailable":
        return {
          text: "Portfolio tracking is only available in development mode.",
        };

      case "not_found":
        return {
          text: "Portfolio not found. Use /portfolio buy <amount> to make your first purchase.",
        };

      case "empty":
        return {
          text:
            "Your portfolio is empty.\n\n" +
            "Target allocations:\n" +
            `- BTC: ${(TARGET_ALLOCATIONS.BTC * 100).toFixed(0)}%\n` +
            `- ETH: ${(TARGET_ALLOCATIONS.ETH * 100).toFixed(0)}%\n` +
            `- SOL: ${(TARGET_ALLOCATIONS.SOL * 100).toFixed(0)}%\n\n` +
            "Use /portfolio buy <amount> to make a mock purchase.",
        };

      case "success": {
        const status = result.status!;
        let text = "Portfolio Status (Mock)\n";
        text += "─".repeat(25) + "\n\n";

        for (const alloc of status.allocations) {
          const currentPct = (alloc.currentAllocation * 100).toFixed(1);
          const targetPct = (alloc.targetAllocation * 100).toFixed(0);
          const devPct = (alloc.deviation * 100).toFixed(1);
          const devSign = alloc.deviation >= 0 ? "+" : "";

          text += `${alloc.symbol}\n`;
          text += `  Balance: ${alloc.balance.toFixed(8)}\n`;
          text += `  Value: $${alloc.valueInUsdc.toFixed(2)}\n`;
          text += `  Alloc: ${currentPct}% / ${targetPct}% (${devSign}${devPct}%)\n\n`;
        }

        text += "─".repeat(25) + "\n";
        text += `Total: $${status.totalValueInUsdc.toFixed(2)}\n\n`;
        text += `Next buy: ${status.assetToBuy} (${(status.maxDeviation * 100).toFixed(1)}% below target)`;

        return { text };
      }

      default:
        return { text: "Unable to retrieve portfolio status." };
    }
  }

  formatReset(result: ResetResult): UIResponse {
    if (result.type === "unavailable") {
      return {
        text: "Portfolio reset is only available in development mode.",
      };
    }

    return {
      text:
        "Portfolio Reset Complete\n" +
        "─".repeat(25) + "\n\n" +
        "All balances set to 0.\n" +
        "Purchase history cleared.\n\n" +
        "Use /portfolio buy <amount> to start fresh.",
    };
  }

  formatUnknownSubcommand(): UIResponse {
    return {
      text:
        "Unknown portfolio command.\n\n" +
        "Available commands:\n" +
        "/portfolio - Show portfolio status\n" +
        "/portfolio buy <amount> - Mock purchase\n" +
        "/portfolio reset - Reset portfolio",
    };
  }
}
