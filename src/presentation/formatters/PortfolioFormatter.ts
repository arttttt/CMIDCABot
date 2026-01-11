/**
 * Portfolio formatter - domain objects to UI response
 */

import { PortfolioStatusResult } from "../../domain/usecases/types.js";
import { TARGET_ALLOCATIONS } from "../../types/portfolio.js";
import { ClientResponse } from "../protocol/types.js";
import { Markdown } from "./markdown.js";

/**
 * Format target allocations from TARGET_ALLOCATIONS constant
 * Returns: "- SOL: 40%\n- BTC: 30%\n- ETH: 30%"
 */
export function formatTargetAllocations(): string {
  return Object.entries(TARGET_ALLOCATIONS)
    .map(([symbol, target]) => `- ${symbol}: ${(target * 100).toFixed(0)}%`)
    .join("\n");
}

export class PortfolioFormatter {
  formatStatus(result: PortfolioStatusResult): ClientResponse {
    switch (result.type) {
      case "unavailable":
        return new ClientResponse(
          `Portfolio tracking is not available. ${Markdown.code("JUPITER_API_KEY")} is required.`,
        );

      case "error":
        return new ClientResponse("Failed to fetch portfolio. Please try again later.");

      case "not_found":
        return new ClientResponse(
          "No wallet connected.\n\n" +
            "Use /wallet create to create a wallet first.",
        );

      case "empty":
        return new ClientResponse(
          "Your portfolio is empty.\n\n" +
            "Target allocations:\n" +
            formatTargetAllocations() + "\n\n" +
            "Use /portfolio buy {amount} to start building your portfolio.",
        );

      case "success": {
        const status = result.status!;
        let text = "**Portfolio Status**\n";
        text += "─".repeat(25) + "\n\n";

        for (const alloc of status.allocations) {
          const currentPct = (alloc.currentAllocation * 100).toFixed(1);
          const targetPct = (alloc.targetAllocation * 100).toFixed(0);
          const devPct = Math.abs(alloc.deviation * 100).toFixed(1);
          const devIndicator = alloc.deviation >= 0 ? "▲" : "▼";
          const devSign = alloc.deviation >= 0 ? "+" : "-";

          text += `${Markdown.escape(alloc.symbol)}\n`;
          text += `  Balance: ${this.formatBalance(alloc.balance, alloc.symbol)}\n`;
          text += `  Value: $${alloc.valueInUsdc.toFixed(2)}\n`;
          text += `  Alloc: ${currentPct}% / ${targetPct}% ${devIndicator} ${devSign}${devPct}%\n\n`;
        }

        text += "─".repeat(25) + "\n";
        text += `Total: $${status.totalValueInUsdc.toFixed(2)}\n\n`;

        if (status.maxDeviation < 0) {
          const deviationPct = Math.abs(status.maxDeviation * 100).toFixed(1);
          text += `Next buy: ${Markdown.escape(status.assetToBuy ?? "")} (${deviationPct}% below target)\n\n`;
          text += `_Command: /portfolio buy <usdc>_`;
        } else {
          text += `Portfolio is balanced`;
        }

        return new ClientResponse(text);
      }

      default:
        return new ClientResponse("Unable to retrieve portfolio status.");
    }
  }

  formatUnknownSubcommand(): ClientResponse {
    return new ClientResponse(
      "Unknown portfolio command.\n\n" +
        "Available commands:\n" +
        "/portfolio - Show portfolio status\n" +
        "/portfolio buy {amount} - Buy asset (USDC)",
    );
  }

  private formatBalance(balance: number, symbol: string): string {
    // Format based on asset type
    if (symbol === "BTC") {
      return balance.toFixed(8);
    } else if (symbol === "ETH") {
      return balance.toFixed(6);
    } else {
      return balance.toFixed(4);
    }
  }
}
