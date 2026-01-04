/**
 * ConfirmationFormatter - formats purchase/swap confirmation messages
 *
 * Provides formatted messages for:
 * - Preview (confirmation request with Confirm/Cancel buttons)
 * - Expired session
 * - Slippage warning with new price
 * - Cancelled operation
 */

import type { SwapQuote } from "../../domain/repositories/SwapRepository.js";
import type { ConfirmationType } from "../../domain/repositories/ConfirmationRepository.js";
import type { ConfirmationSessionId } from "../../domain/models/id/index.js";
import { SlippageCalculator } from "../../domain/helpers/SlippageCalculator.js";
import { ClientResponse, ClientButton } from "../protocol/types.js";
import { Markdown } from "./markdown.js";

export class ConfirmationFormatter {
  /**
   * Format amount with appropriate precision
   */
  private static formatAmount(amount: number): string {
    if (amount >= 1000) {
      return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (amount >= 1) {
      return amount.toFixed(4);
    }
    if (amount >= 0.0001) {
      return amount.toFixed(6);
    }
    return amount.toFixed(8);
  }

  /**
   * Format price with appropriate precision
   */
  private static formatPrice(price: number): string {
    if (price >= 1000) {
      return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toFixed(2);
  }

  /**
   * Format preview message with Confirm/Cancel buttons
   */
  formatPreview(
    type: ConfirmationType,
    _amount: number,
    _asset: string,
    quote: SwapQuote,
    sessionId: ConfirmationSessionId,
    ttlSeconds: number,
  ): ClientResponse {
    const pricePerUnit = quote.inputAmount / quote.outputAmount;
    const slippagePct = quote.slippageBps / 100;

    const typeLabel = type === "portfolio_buy" ? "Portfolio Purchase" : "Swap";
    const commandPrefix = type === "portfolio_buy" ? "portfolio/buy" : "swap/execute";

    const lines = [
      `*${typeLabel} Preview*`,
      "",
      `*Spend:* ${ConfirmationFormatter.formatAmount(quote.inputAmount)} ${Markdown.escape(quote.inputSymbol)}`,
      `*Receive:* ~${ConfirmationFormatter.formatAmount(quote.outputAmount)} ${Markdown.escape(quote.outputSymbol)}`,
      "",
      `*Price:* 1 ${Markdown.escape(quote.outputSymbol)} = ${ConfirmationFormatter.formatPrice(pricePerUnit)} USDC`,
      `*Min Receive:* ${ConfirmationFormatter.formatAmount(quote.minOutputAmount)} ${Markdown.escape(quote.outputSymbol)}`,
      `*Slippage:* ${slippagePct}%`,
      "",
      `_Confirm within ${ttlSeconds} seconds_`,
    ];

    const buttons: ClientButton[][] = [
      [
        { text: "Confirm", callbackData: `${commandPrefix}:confirm:${sessionId.value}` },
        { text: "Cancel", callbackData: `${commandPrefix}:cancel:${sessionId.value}` },
      ],
    ];

    return new ClientResponse(lines.join("\n"), buttons);
  }

  /**
   * Format expired session message
   */
  formatExpired(type: ConfirmationType): ClientResponse {
    const typeLabel = type === "portfolio_buy" ? "Purchase" : "Swap";
    return new ClientResponse(
      `${typeLabel} confirmation expired.\n\n` +
      `Please start a new ${typeLabel.toLowerCase()} if you still want to proceed.`,
    );
  }

  /**
   * Format slippage warning with new price (re-confirmation request)
   */
  formatSlippageWarning(
    type: ConfirmationType,
    originalQuote: SwapQuote,
    freshQuote: SwapQuote,
    sessionId: ConfirmationSessionId,
    ttlSeconds: number,
  ): ClientResponse {
    const slippageBps = SlippageCalculator.calculateBps(originalQuote, freshQuote);
    const slippagePct = (slippageBps / 100).toFixed(2);

    const originalPrice = originalQuote.inputAmount / originalQuote.outputAmount;
    const newPrice = freshQuote.inputAmount / freshQuote.outputAmount;

    const priceDirection = newPrice > originalPrice ? "increased" : "decreased";
    const outputDirection = freshQuote.outputAmount < originalQuote.outputAmount ? "less" : "more";

    const commandPrefix = type === "portfolio_buy" ? "portfolio/buy" : "swap/execute";

    const lines = [
      `*Price Changed*`,
      "",
      `The price has ${priceDirection} since your quote.`,
      "",
      `*Original:* ~${ConfirmationFormatter.formatAmount(originalQuote.outputAmount)} ${Markdown.escape(originalQuote.outputSymbol)}`,
      `*New:* ~${ConfirmationFormatter.formatAmount(freshQuote.outputAmount)} ${Markdown.escape(freshQuote.outputSymbol)}`,
      "",
      `*Price change:* ${slippagePct}% (${outputDirection} ${Markdown.escape(freshQuote.outputSymbol)})`,
      "",
      `Do you want to proceed with the new price?`,
      "",
      `_Confirm within ${ttlSeconds} seconds_`,
    ];

    const buttons: ClientButton[][] = [
      [
        { text: "Confirm", callbackData: `${commandPrefix}:confirm:${sessionId.value}` },
        { text: "Cancel", callbackData: `${commandPrefix}:cancel:${sessionId.value}` },
      ],
    ];

    return new ClientResponse(lines.join("\n"), buttons);
  }

  /**
   * Format cancelled operation message
   */
  formatCancelled(type: ConfirmationType): ClientResponse {
    const typeLabel = type === "portfolio_buy" ? "Purchase" : "Swap";
    return new ClientResponse(`${typeLabel} cancelled.`);
  }

  /**
   * Format max slippage exceeded message (after re-confirmation limit)
   */
  formatMaxSlippageExceeded(type: ConfirmationType): ClientResponse {
    const typeLabel = type === "portfolio_buy" ? "Purchase" : "Swap";
    return new ClientResponse(
      `${typeLabel} cancelled due to excessive price movement.\n\n` +
      `The price changed significantly multiple times. ` +
      `Please try again when the market is more stable.`,
    );
  }

  /**
   * Format session not found message
   */
  formatSessionNotFound(): ClientResponse {
    return new ClientResponse(
      `Session not found or expired.\n\n` +
      `Please start a new operation.`,
    );
  }
}
