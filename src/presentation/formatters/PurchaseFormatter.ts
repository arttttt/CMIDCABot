/**
 * Purchase formatter - domain objects to UI response
 */

import type { SwapResult } from "../../domain/models/SwapStep.js";
import { ClientResponse } from "../protocol/types.js";
import { Markdown } from "./markdown.js";

export class PurchaseFormatter {
  format(result: SwapResult): ClientResponse {
    switch (result.status) {
      case "invalid_amount":
        return new ClientResponse(`Invalid amount: ${Markdown.escape(result.message)}`);

      case "invalid_asset":
        return new ClientResponse(`Invalid asset: ${Markdown.escape(result.message)}`);

      case "operation_in_progress":
        return new ClientResponse(
          "Another balance-changing operation is already in progress. " +
            "Please finish it before starting a new one.",
        );

      case "no_wallet":
        return new ClientResponse(
          "No wallet connected.\n\n" +
            "Use /wallet create to create a new wallet first.",
        );

      case "insufficient_usdc_balance":
        return new ClientResponse("Insufficient USDC balance.");

      case "insufficient_sol_balance":
        return new ClientResponse("Insufficient SOL balance.");

      case "quote_error":
        return new ClientResponse(`Failed to get quote: ${Markdown.escape(result.message)}`);

      case "build_error":
        return new ClientResponse(`Failed to build transaction: ${Markdown.escape(result.message)}`);

      case "send_error": {
        const errorText = `Transaction failed: ${Markdown.escape(result.message)}`;
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

      case "high_price_impact":
        return new ClientResponse(
          `Price impact too high: ${result.priceImpactPct.toFixed(2)}%\n\n` +
            "This usually means low liquidity. Try a smaller amount.",
        );

      case "success": {
        const confirmStatus = result.confirmed ? "Confirmed" : "Confirmation timeout";
        const explorerUrl = `https://solscan.io/tx/${result.signature}`;
        const asset = result.quote.outputSymbol;
        const amountAsset = result.quote.outputAmount;
        const amountUsdc = result.quote.inputAmount;
        const priceUsd = amountUsdc / amountAsset;

        return ClientResponse.sensitive(
          `Purchase Complete\n` +
            `${"─".repeat(25)}\n\n` +
            `Asset: ${Markdown.escape(asset)}\n` +
            `Amount: ${amountAsset.toFixed(8)} ${Markdown.escape(asset)}\n` +
            `Cost: ${amountUsdc} USDC\n` +
            `Price: $${priceUsd.toLocaleString()}\n\n` +
            `Status: ${confirmStatus}\n` +
            `${Markdown.link("View on Solscan", explorerUrl)}\n\n` +
            `Use /portfolio to see your updated portfolio.`,
        );
      }
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
