/**
 * ProgressFormatter - Formats operation progress steps for display
 *
 * Converts domain step types to UI responses with mode indicator:
 * - 'edit': Update existing message (status-only steps)
 * - 'new': Send new message (steps with useful data)
 *
 * Note: Status messages (getting_quote, building_transaction, etc.) are static
 * English strings that don't contain user input, so Markdown.escape() is not needed.
 * Dynamic content (quotes, allocations) uses Markdown.escape() for safety.
 */

import type { SwapStep, PurchaseStep, QuoteInfo } from "../../domain/models/index.js";
import type { AssetAllocation } from "../../domain/models/PortfolioTypes.js";
import { ClientResponse } from "../protocol/types.js";
import { Markdown } from "./markdown.js";

/**
 * Formatted progress with display mode
 */
export interface FormattedProgress {
  response: ClientResponse;
  mode: "edit" | "new";
}

/**
 * Exhaustive type check helper - ensures all cases are handled at compile time
 */
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}

/**
 * Progress formatter for swap and purchase operations
 */
export class ProgressFormatter {
  /**
   * Format swap step (progress only, not completed)
   *
   * Note: Completed steps should be filtered out by the caller and formatted
   * by SwapFormatter instead. This method uses exhaustive type checking.
   */
  formatSwapStep(step: SwapStep): FormattedProgress {
    switch (step.step) {
      case "checking_balance":
        // Static status message - no escape needed
        return {
          response: new ClientResponse("Checking USDC balance..."),
          mode: "edit",
        };

      case "getting_quote":
        // Static status message - no escape needed
        return {
          response: new ClientResponse("Getting quote from Jupiter..."),
          mode: "edit",
        };

      case "quote_received":
        return {
          response: this.formatQuoteReceived(step.quote),
          mode: "new",
        };

      case "building_transaction":
        // Static status message - no escape needed
        return {
          response: new ClientResponse("Building transaction..."),
          mode: "edit",
        };

      case "sending_transaction":
        // Static status message - no escape needed
        return {
          response: new ClientResponse("Signing and sending transaction..."),
          mode: "edit",
        };

      case "completed":
        // Completed steps must be handled by caller, not ProgressFormatter
        return assertNever(step.step as never);
    }
  }

  /**
   * Format purchase step (progress only, not completed)
   *
   * Note: Completed steps should be filtered out by the caller and formatted
   * by PurchaseFormatter instead. This method uses exhaustive type checking.
   */
  formatPurchaseStep(step: PurchaseStep): FormattedProgress {
    switch (step.step) {
      case "checking_balance":
        // Static status message - no escape needed
        return {
          response: new ClientResponse("Checking USDC balance..."),
          mode: "edit",
        };

      case "selecting_asset":
        // Static status message - no escape needed
        return {
          response: new ClientResponse("Analyzing portfolio allocation..."),
          mode: "edit",
        };

      case "asset_selected":
        return {
          response: this.formatAssetSelected(step.selection),
          mode: "new",
        };

      case "swap":
        return this.formatSwapStep(step.swapStep);

      case "completed":
        // Completed steps must be handled by caller, not ProgressFormatter
        return assertNever(step.step as never);
    }
  }

  /**
   * Format quote received with trade details
   */
  private formatQuoteReceived(quote: QuoteInfo): ClientResponse {
    const pricePerUnit = quote.inputAmount / quote.outputAmount;
    const slippagePercent = quote.slippageBps / 100;
    const routeStr = quote.route.join(" → ");

    const lines = [
      "*Quote Received*",
      "",
      `${this.formatAmount(quote.inputAmount)} ${Markdown.escape(quote.inputSymbol)} → ` +
        `${this.formatAmount(quote.outputAmount)} ${Markdown.escape(quote.outputSymbol)}`,
      "",
      `Price: 1 ${Markdown.escape(quote.outputSymbol)} = ${this.formatPrice(pricePerUnit)} USDC`,
      `Price Impact: ${this.formatPercent(quote.priceImpactPct)}`,
      `Max Slippage: ${slippagePercent.toFixed(2)}%`,
      `Route: ${Markdown.escape(routeStr)}`,
    ];

    return new ClientResponse(lines.join("\n"));
  }

  /**
   * Format asset selection with allocation details
   */
  private formatAssetSelected(selection: AssetAllocation): ClientResponse {
    const currentPct = (selection.currentAllocation * 100).toFixed(1);
    const targetPct = (selection.targetAllocation * 100).toFixed(1);
    const deviationPct = (selection.deviation * 100).toFixed(1);

    const lines = [
      `*Buying ${Markdown.escape(selection.symbol)}*`,
      "",
      `Current allocation: ${currentPct}%`,
      `Target allocation: ${targetPct}%`,
      `Deviation: ${deviationPct}%`,
      "",
      `${Markdown.escape(selection.symbol)} is the most underweight asset.`,
    ];

    return new ClientResponse(lines.join("\n"));
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

  private formatPercent(pct: number): string {
    if (pct < 0.01) {
      return "<0.01%";
    }
    return `${pct.toFixed(2)}%`;
  }
}
