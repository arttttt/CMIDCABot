/**
 * Discover assets use case
 *
 * Resolves the user's wallet, discovers all liquid tokens and DeFi
 * positions, enriches tokens with USD prices and computes totals.
 */

import type { TelegramId } from "../models/id/index.js";
import type { DiscoveredAssets, TokenHolding } from "../models/DiscoveredAssets.js";
import { TOKENS } from "../constants/tokens.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { AssetDiscoveryRepository } from "../repositories/AssetDiscoveryRepository.js";
import { PriceRepository } from "../repositories/PriceRepository.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export type DiscoverAssetsResult =
  | { type: "success"; assets: DiscoveredAssets }
  | { type: "not_found" }
  | { type: "error"; error: string };

/**
 * Known portfolio symbols by mint address
 */
const KNOWN_SYMBOLS: Record<string, string> = Object.fromEntries(
  Object.entries(TOKENS).map(([symbol, config]) => [config.mint.value, symbol]),
);

export class DiscoverAssetsUseCase {
  constructor(
    private userRepository: UserRepository,
    private assetDiscoveryRepository: AssetDiscoveryRepository,
    private priceRepository: PriceRepository,
  ) {}

  async execute(telegramId: TelegramId): Promise<DiscoverAssetsResult> {
    logger.info("DiscoverAssets", "Discovering wallet assets", { telegramId });

    const user = await this.userRepository.getById(telegramId);
    const walletAddr = user?.walletAddress ?? undefined;

    if (!walletAddr) {
      return { type: "not_found" };
    }

    try {
      const raw = await this.assetDiscoveryRepository.discover(walletAddr);

      const mints = raw.tokens.map((token) => token.mint);
      const prices =
        mints.length > 0 ? await this.priceRepository.getUsdPricesByMint(mints) : {};

      const tokens = raw.tokens
        .map((token) => this.enrichToken(token, prices))
        .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));

      const tokensTotal = tokens.reduce((sum, token) => sum + (token.usdValue ?? 0), 0);
      const positionsTotal = raw.positions.reduce(
        (sum, position) => sum + (position.usdValue ?? 0),
        0,
      );

      const assets: DiscoveredAssets = {
        wallet: walletAddr,
        tokens,
        positions: raw.positions,
        failedSources: raw.failedSources,
        totalUsdValue: tokensTotal + positionsTotal,
        fetchedAt: new Date(),
      };

      logger.info("DiscoverAssets", "Assets discovered", {
        tokens: tokens.length,
        positions: raw.positions.length,
        failedSources: raw.failedSources.length,
        totalUsd: assets.totalUsdValue.toFixed(2),
      });

      return { type: "success", assets };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("DiscoverAssets", "Discovery failed", { error: errorMessage });
      return { type: "error", error: errorMessage };
    }
  }

  private enrichToken(
    token: TokenHolding,
    prices: Record<string, number>,
  ): TokenHolding {
    const symbol = KNOWN_SYMBOLS[token.mint];
    const usdPrice = prices[token.mint];

    return {
      ...token,
      ...(symbol !== undefined && { symbol }),
      ...(usdPrice !== undefined && {
        usdPrice,
        usdValue: token.amount * usdPrice,
      }),
    };
  }
}
