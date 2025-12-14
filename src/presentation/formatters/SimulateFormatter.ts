/**
 * SimulateFormatter - Formats swap simulation results for display
 */

import { SimulateSwapResult } from "../../domain/usecases/SimulateSwapUseCase.js";
import { UIResponse } from "../protocol/types.js";

export class SimulateFormatter {
  format(result: SimulateSwapResult): UIResponse {
    if (result.status === "unavailable") {
      return { text: "Simulation unavailable (requires JUPITER_API_KEY)" };
    }

    if (result.status === "no_wallet") {
      return {
        text: "No wallet found. Create one with `/wallet create`",
      };
    }

    if (result.status === "insufficient_balance") {
      return {
        text: `Insufficient USDC balance.\nRequired: ${result.required} USDC\nAvailable: ${result.available} USDC`,
      };
    }

    if (result.status === "invalid_amount") {
      return { text: `Invalid amount: ${result.message}` };
    }

    if (result.status === "invalid_asset") {
      return { text: `Invalid asset: ${result.message}` };
    }

    if (result.status === "quote_error") {
      return { text: `Failed to get quote: ${result.message}` };
    }

    if (result.status === "build_error") {
      return { text: `Failed to build transaction: ${result.message}` };
    }

    if (result.status === "simulation_error") {
      return { text: `Simulation failed: ${result.message}` };
    }

    const { quote, simulation } = result;

    const statusIcon = simulation.success ? "PASSED" : "FAILED";
    const pricePerUnit = quote.inputAmount / quote.outputAmount;

    const lines = [
      `*Swap Simulation: ${statusIcon}*`,
      "",
      "*Quote:*",
      `  Spend: ${this.formatAmount(quote.inputAmount)} ${quote.inputSymbol}`,
      `  Receive: ${this.formatAmount(quote.outputAmount)} ${quote.outputSymbol}`,
      `  Price: 1 ${quote.outputSymbol} = ${this.formatPrice(pricePerUnit)} USDC`,
      `  Route: ${quote.route.join(" -> ") || "Direct"}`,
      "",
      "*Simulation:*",
      `  Status: ${simulation.success ? "Success" : "Failed"}`,
    ];

    if (simulation.unitsConsumed !== null) {
      lines.push(`  Compute Units: ${simulation.unitsConsumed.toLocaleString()}`);
    }

    if (simulation.error) {
      lines.push("");
      lines.push(`*Error:* ${this.formatError(simulation.error)}`);
    }

    // Show relevant logs (filter out noise)
    const relevantLogs = this.filterLogs(simulation.logs);
    if (relevantLogs.length > 0) {
      lines.push("");
      lines.push("*Logs:*");
      relevantLogs.slice(0, 5).forEach((log) => {
        lines.push(`  ${log}`);
      });
      if (relevantLogs.length > 5) {
        lines.push(`  ... and ${relevantLogs.length - 5} more`);
      }
    }

    if (simulation.success) {
      lines.push("");
      lines.push("_Transaction ready for execution_");
    }

    return { text: lines.join("\n") };
  }

  formatUsage(): UIResponse {
    return {
      text: [
        "*Swap Simulate*",
        "",
        "Simulate a swap transaction without executing it.",
        "Tests the full swap path: quote -> build -> simulate.",
        "",
        "*Usage:* `/swap simulate <usdc> [asset]`",
        "",
        "*Examples:*",
        "  `/swap simulate 1` - simulate buying SOL for 1 USDC",
        "  `/swap simulate 5 BTC` - simulate buying BTC for 5 USDC",
        "  `/swap simulate 10 ETH` - simulate buying ETH for 10 USDC",
        "",
        "*Supported assets:* BTC, ETH, SOL",
        "",
        "_No funds are moved. This tests if the swap would succeed._",
      ].join("\n"),
    };
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

  private formatError(error: string): string {
    // Parse common Solana errors
    if (error.includes("InstructionError")) {
      try {
        const parsed = JSON.parse(error);
        if (parsed.InstructionError) {
          const [index, err] = parsed.InstructionError;
          if (typeof err === "object") {
            return `Instruction ${index}: ${JSON.stringify(err)}`;
          }
          return `Instruction ${index}: ${err}`;
        }
      } catch {
        // Return as-is if parsing fails
      }
    }

    // Truncate long errors
    if (error.length > 200) {
      return error.substring(0, 200) + "...";
    }

    return error;
  }

  private filterLogs(logs: string[]): string[] {
    return logs.filter((log) => {
      // Filter out invoke/success noise, keep interesting logs
      if (log.includes("Program log:")) return true;
      if (log.includes("failed")) return true;
      if (log.includes("error")) return true;
      if (log.includes("insufficient")) return true;
      return false;
    });
  }
}
