/**
 * SimulateFormatter - Formats swap simulation results for display
 */

import { SimulateSwapResult } from "../../domain/usecases/SimulateSwapUseCase.js";
import { ClientResponse } from "../protocol/types.js";
import { Markdown } from "./markdown.js";

export class SimulateFormatter {
  format(result: SimulateSwapResult): ClientResponse {
    if (result.status === "unavailable") {
      return new ClientResponse(`Simulation unavailable (requires ${Markdown.code("JUPITER_API_KEY")})`);
    }

    if (result.status === "no_wallet") {
      return new ClientResponse(`No wallet found. Create one with ${Markdown.code("/wallet create")}`);
    }

    if (result.status === "insufficient_usdc_balance") {
      return new ClientResponse("Insufficient USDC balance.");
    }

    if (result.status === "insufficient_sol_balance") {
      return new ClientResponse("Insufficient SOL balance.");
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

    if (result.status === "simulation_error") {
      return new ClientResponse(`Simulation failed: ${Markdown.escape(result.message ?? "")}`);
    }

    const { quote, simulation } = result;

    const statusIcon = simulation.success ? "PASSED" : "FAILED";
    const pricePerUnit = quote.inputAmount / quote.outputAmount;

    const routeDisplay = quote.route.map((r) => Markdown.escape(r)).join(" -> ") || "Direct";

    const lines = [
      `*Swap Simulation: ${statusIcon}*`,
      "",
      "*Quote:*",
      `  Spend: ${this.formatAmount(quote.inputAmount)} ${Markdown.escape(quote.inputSymbol)}`,
      `  Receive: ${this.formatAmount(quote.outputAmount)} ${Markdown.escape(quote.outputSymbol)}`,
      `  Price: 1 ${Markdown.escape(quote.outputSymbol)} = ${this.formatPrice(pricePerUnit)} USDC`,
      `  Route: ${routeDisplay}`,
      "",
      "*Simulation:*",
      `  Status: ${simulation.success ? "Success" : "Failed"}`,
    ];

    if (simulation.unitsConsumed !== null) {
      lines.push(`  Compute Units: ${simulation.unitsConsumed.toLocaleString()}`);
    }

    if (simulation.error) {
      lines.push("");
      lines.push(`*Error:* ${Markdown.escape(this.formatError(simulation.error))}`);
    }

    // Show relevant logs (filter out noise)
    const relevantLogs = this.filterLogs(simulation.logs);
    if (relevantLogs.length > 0) {
      lines.push("");
      lines.push("*Logs:*");
      relevantLogs.slice(0, 5).forEach((log) => {
        lines.push(`  ${Markdown.escape(log)}`);
      });
      if (relevantLogs.length > 5) {
        lines.push(`  ... and ${relevantLogs.length - 5} more`);
      }
    }

    if (simulation.success) {
      lines.push("");
      lines.push("_Transaction ready for execution_");
    }

    return new ClientResponse(lines.join("\n"));
  }

  formatUsage(): ClientResponse {
    return new ClientResponse(
      [
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
