/**
 * ExecuteMockPurchaseUseCase - simulates a purchase without real swap (dev-only)
 *
 * Updates mock portfolio balances based on current prices.
 */

import type { TelegramId } from "../../types/id/index.js";
import { PortfolioRepository } from "../repositories/PortfolioRepository.js";
import { PurchaseRepository } from "../repositories/PurchaseRepository.js";
import { PriceRepository } from "../repositories/PriceRepository.js";
import { AssetSymbol } from "../../types/portfolio.js";
import { AllocationCalculator } from "../helpers/AllocationCalculator.js";
import { divideAmount } from "../../infrastructure/shared/math/index.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export interface MockPurchaseResult {
  success: boolean;
  asset: AssetSymbol;
  amount: number;
  priceUsd: number;
  message: string;
}

export class ExecuteMockPurchaseUseCase {
  constructor(
    private portfolioRepository: PortfolioRepository,
    private purchaseRepository: PurchaseRepository,
    private priceRepository: PriceRepository,
  ) {}

  async execute(
    telegramId: TelegramId,
    amountUsdc: number,
    asset?: AssetSymbol,
  ): Promise<MockPurchaseResult> {
    logger.info("ExecuteMockPurchase", "Executing mock purchase", {
      telegramId,
      amountUsdc,
      requestedAsset: asset,
    });

    try {
      // Ensure portfolio exists
      await this.portfolioRepository.create(telegramId);

      // Get current prices
      const prices = await this.priceRepository.getPricesRecord();
      const priceSource = this.priceRepository.getPriceSource();

      // Select asset if not specified
      let selectedAsset = asset;
      if (!selectedAsset) {
        const portfolio = await this.portfolioRepository.getById(telegramId);
        if (portfolio) {
          selectedAsset = AllocationCalculator.selectAssetToBuy(
            {
              btcBalance: portfolio.btcBalance,
              ethBalance: portfolio.ethBalance,
              solBalance: portfolio.solBalance,
            },
            prices,
          );
        } else {
          // New portfolio - start with BTC (largest target)
          selectedAsset = "BTC";
        }
      }

      // Calculate amount of asset to receive
      const priceUsd = prices[selectedAsset];
      const amountAsset = divideAmount(amountUsdc, priceUsd).toNumber();

      // Update portfolio balance
      await this.portfolioRepository.updateBalance(telegramId, selectedAsset, amountAsset);

      // Record the purchase
      await this.purchaseRepository.create({
        telegramId,
        assetSymbol: selectedAsset,
        amountUsdc,
        amountAsset,
        priceUsd,
      });

      const message = `Purchased ${amountAsset.toFixed(8)} ${selectedAsset} for ${amountUsdc} USDC @ $${priceUsd.toFixed(2)} (${priceSource})`;

      logger.info("ExecuteMockPurchase", "Mock purchase completed", {
        telegramId,
        asset: selectedAsset,
        amount: amountAsset,
        priceUsd,
      });

      return {
        success: true,
        asset: selectedAsset,
        amount: amountAsset,
        priceUsd,
        message,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("ExecuteMockPurchase", "Mock purchase failed", { error: errorMessage });

      return {
        success: false,
        asset: "BTC",
        amount: 0,
        priceUsd: 0,
        message: `Mock purchase failed: ${errorMessage}`,
      };
    }
  }
}
