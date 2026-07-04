/**
 * Assets formatter - discovered wallet assets to UI response
 */

import type { DiscoverAssetsResult } from "../../domain/usecases/DiscoverAssetsUseCase.js";
import type {
  DefiPosition,
  DiscoveredAssets,
  TokenHolding,
} from "../../domain/models/DiscoveredAssets.js";
import { ClientResponse } from "../protocol/types.js";
import { Markdown } from "./markdown.js";
import { NumberFormatter } from "./NumberFormatter.js";

const SEPARATOR = "─".repeat(25);

export class AssetsFormatter {
  format(result: DiscoverAssetsResult): ClientResponse {
    switch (result.type) {
      case "not_found":
        return new ClientResponse(
          "No wallet connected.\n\n" + "Use /wallet create to create a wallet first.",
        );

      case "error":
        return new ClientResponse("Failed to discover assets. Please try again later.");

      case "success":
        return new ClientResponse(this.formatAssets(result.assets));
    }
  }

  private formatAssets(assets: DiscoveredAssets): string {
    let text = "*Wallet Assets*\n";
    text += SEPARATOR + "\n\n";

    text += "*Tokens*\n";
    for (const token of assets.tokens) {
      text += this.formatToken(token) + "\n";
    }

    if (assets.positions.length > 0) {
      text += "\n*DeFi positions*\n";
      for (const position of assets.positions) {
        text += this.formatPosition(position) + "\n";
      }
    }

    text += "\n" + SEPARATOR + "\n";
    text += `Total: $${NumberFormatter.formatPrice(assets.totalUsdValue)}`;

    if (assets.failedSources.length > 0) {
      const sources = assets.failedSources.map((source) => Markdown.escape(source)).join(", ");
      text += `\n\n_Some sources failed: ${sources}. Result is partial._`;
    }

    return text;
  }

  private formatToken(token: TokenHolding): string {
    const name = token.symbol
      ? Markdown.escape(token.symbol)
      : Markdown.code(this.shortMint(token.mint));
    const amount = NumberFormatter.formatAmount(token.amount);
    const value =
      token.usdValue !== undefined
        ? `$${NumberFormatter.formatPrice(token.usdValue)}`
        : "no price";

    return `${name} — ${amount} (${value})`;
  }

  private formatPosition(position: DefiPosition): string {
    const header = `${Markdown.escape(position.platform)} · ${Markdown.escape(position.label)} (${position.kind})`;

    const assetLines = position.assets.map((asset) => {
      const name = asset.symbol
        ? Markdown.escape(asset.symbol)
        : asset.mint
          ? Markdown.code(this.shortMint(asset.mint))
          : "?";
      const amount = NumberFormatter.formatAmount(asset.amount);
      const value =
        asset.usdValue !== undefined ? ` ($${NumberFormatter.formatPrice(asset.usdValue)})` : "";
      return `  ${name}: ${amount}${value}`;
    });

    const total =
      position.usdValue !== undefined
        ? `  Value: $${NumberFormatter.formatPrice(position.usdValue)}`
        : undefined;

    return [header, ...assetLines, ...(total ? [total] : [])].join("\n");
  }

  private shortMint(mint: string): string {
    return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
  }
}
