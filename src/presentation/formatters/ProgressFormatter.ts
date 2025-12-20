/**
 * ProgressFormatter - Formats operation progress steps for display
 *
 * Converts domain step types to UI responses with mode indicator:
 * - 'edit': Update existing message (status-only steps)
 * - 'new': Send new message (steps with useful data)
 */

import type { SwapStep, PurchaseStep, QuoteInfo, AssetSelectionInfo } from "../../domain/models/index.js";
import type { UIResponse } from "../protocol/types.js";
import { Markdown } from "./markdown.js";

/**
 * Formatted progress with display mode
 */
export interface FormattedProgress {
  response: UIResponse;
  mode: "edit" | "new";
}

/**
 * Progress formatter for swap and purchase operations
 */
export class ProgressFormatter {
  /**
   * Format swap step
   */
  formatSwapStep(step: SwapStep): FormattedProgress {
    switch (step.step) {
      case "getting_quote":
        return {
          response: { text: "Getting quote from Jupiter..." },
          mode: "edit",
        };

      case "quote_received":
        return {
          response: this.formatQuoteReceived(step.quote),
          mode: "new",
        };

      case "building_transaction":
        return {
          response: { text: "Building transaction..." },
          mode: "edit",
        };

      case "sending_transaction":
        return {
          response: { text: "Signing and sending transaction..." },
          mode: "edit",
        };

      case "completed":
        // Completed steps are formatted by SwapFormatter, not ProgressFormatter
        throw new Error("ProgressFormatter should not receive completed step");
    }
  }

  /**
   * Format purchase step
   */
  formatPurchaseStep(step: PurchaseStep): FormattedProgress {
    switch (step.step) {
      case "selecting_asset":
        return {
          response: { text: "Analyzing portfolio allocation..." },
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
        // Completed steps are formatted by PurchaseFormatter, not ProgressFormatter
        throw new Error("ProgressFormatter should not receive completed step");
    }
  }

  /**
   * Format quote received with trade details
   */
  private formatQuoteReceived(quote: QuoteInfo): UIResponse {
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

    return { text: lines.join("\n") };
  }

  /**
   * Format asset selection with allocation details
   */
  private formatAssetSelected(selection: AssetSelectionInfo): UIResponse {
    const currentPct = (selection.currentAllocation * 100).toFixed(1);
    const targetPct = (selection.targetAllocation * 100).toFixed(1);
    const deviationPct = (selection.deviation * 100).toFixed(1);

    const lines = [
      `*Buying ${Markdown.escape(selection.asset)}*`,
      "",
      `Current allocation: ${currentPct}%`,
      `Target allocation: ${targetPct}%`,
      `Deviation: ${deviationPct}%`,
      "",
      `${Markdown.escape(selection.asset)} is the most underweight asset.`,
    ];

    return { text: lines.join("\n") };
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
