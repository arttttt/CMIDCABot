/**
 * Execute purchase use case - real swap via Jupiter
 * Automatically selects the asset furthest below target allocation
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { SolanaService } from "../../services/solana.js";
import { PriceService, TOKEN_MINTS } from "../../services/price.js";
import { TOKEN_DECIMALS } from "../../services/jupiter-swap.js";
import { AssetSymbol, TARGET_ALLOCATIONS } from "../../types/portfolio.js";
import { PurchaseResult } from "./types.js";
import { ExecuteSwapUseCase, ExecuteSwapResult } from "./ExecuteSwapUseCase.js";
import { logger } from "../../services/logger.js";

export class ExecutePurchaseUseCase {
  constructor(
    private userRepository: UserRepository,
    private executeSwapUseCase: ExecuteSwapUseCase,
    private solanaService: SolanaService,
    private priceService: PriceService | undefined,
    private devPrivateKey?: string,
  ) {}

  async execute(telegramId: number, amountUsdc: number): Promise<PurchaseResult> {
    logger.info("ExecutePurchase", "Executing portfolio purchase", {
      telegramId,
      amountUsdc,
    });

    // Check if PriceService is available (needed for selectAssetToBuy)
    if (!this.priceService) {
      logger.warn("ExecutePurchase", "Price service unavailable");
      return { type: "unavailable" };
    }

    // Validate amount
    if (isNaN(amountUsdc) || amountUsdc <= 0) {
      logger.warn("ExecutePurchase", "Invalid amount", { amountUsdc });
      return { type: "invalid_amount" };
    }

    if (amountUsdc < 0.01) {
      return {
        type: "invalid_amount",
        error: "Minimum amount is 0.01 USDC",
      };
    }

    // Get wallet address for portfolio selection
    let walletAddress: string | undefined;

    if (this.devPrivateKey) {
      walletAddress = await this.solanaService.getAddressFromPrivateKey(this.devPrivateKey);
    } else {
      const user = await this.userRepository.getById(telegramId);
      walletAddress = user?.walletAddress ?? undefined;
    }

    if (!walletAddress) {
      logger.warn("ExecutePurchase", "No wallet connected", { telegramId });
      return { type: "no_wallet" };
    }

    // Determine which asset to buy based on portfolio allocation
    const assetToBuy = await this.selectAssetToBuy(walletAddress);
    logger.info("ExecutePurchase", "Selected asset to buy", { asset: assetToBuy });

    // Delegate to ExecuteSwapUseCase
    const swapResult = await this.executeSwapUseCase.execute(telegramId, amountUsdc, assetToBuy);

    // Map ExecuteSwapResult to PurchaseResult
    return this.mapSwapResultToPurchaseResult(swapResult, assetToBuy, amountUsdc);
  }

  /**
   * Map ExecuteSwapResult to PurchaseResult
   */
  private mapSwapResultToPurchaseResult(
    swapResult: ExecuteSwapResult,
    asset: AssetSymbol,
    amountUsdc: number,
  ): PurchaseResult {
    switch (swapResult.status) {
      case "success": {
        const priceUsd = amountUsdc / swapResult.quote.outputAmount;
        logger.info("ExecutePurchase", "Purchase completed", {
          signature: swapResult.signature,
          confirmed: swapResult.confirmed,
          asset,
          amount: swapResult.quote.outputAmount,
          amountUsdc,
          priceUsd,
        });
        return {
          type: "success",
          asset,
          amountAsset: swapResult.quote.outputAmount,
          amountUsdc,
          priceUsd,
          signature: swapResult.signature,
          confirmed: swapResult.confirmed,
        };
      }
      case "unavailable":
        return { type: "unavailable" };
      case "no_wallet":
        return { type: "no_wallet" };
      case "invalid_amount":
        return { type: "invalid_amount", error: swapResult.message };
      case "invalid_asset":
        // This should not happen since we control the asset selection
        return { type: "invalid_amount", error: swapResult.message };
      case "insufficient_balance":
        return {
          type: "insufficient_balance",
          requiredBalance: swapResult.required,
          availableBalance: swapResult.available,
        };
      case "quote_error":
        return { type: "quote_error", error: swapResult.message };
      case "build_error":
        return { type: "build_error", error: swapResult.message };
      case "send_error":
        return { type: "send_error", error: swapResult.message };
      case "rpc_error":
        return { type: "rpc_error", error: swapResult.message };
    }
  }

  /**
   * Select asset to buy based on portfolio allocation
   *
   * Uses "Crypto Majors Index" rebalancing strategy:
   * - Target: BTC 40%, ETH 30%, SOL 30%
   * - Buys the asset furthest below its target allocation
   *
   * This approach naturally rebalances the portfolio over time:
   * each purchase reduces the deviation of the most underweight asset.
   */
  private async selectAssetToBuy(walletAddress: string): Promise<AssetSymbol> {
    try {
      // Fetch all balances and prices in parallel for efficiency
      const [solBalance, btcBalance, ethBalance, prices] = await Promise.all([
        this.solanaService.getBalance(walletAddress),
        this.solanaService.getTokenBalance(walletAddress, TOKEN_MINTS.BTC, TOKEN_DECIMALS.BTC),
        this.solanaService.getTokenBalance(walletAddress, TOKEN_MINTS.ETH, TOKEN_DECIMALS.ETH),
        this.priceService!.getPricesRecord(),
      ]);

      // Calculate USD value of each asset holding
      const assets: { symbol: AssetSymbol; valueInUsdc: number }[] = [
        { symbol: "BTC", valueInUsdc: btcBalance * prices.BTC },
        { symbol: "ETH", valueInUsdc: ethBalance * prices.ETH },
        { symbol: "SOL", valueInUsdc: solBalance * prices.SOL },
      ];

      const totalValueInUsdc = assets.reduce((sum, a) => sum + a.valueInUsdc, 0);

      // Empty portfolio: start with BTC (largest target at 40%)
      if (totalValueInUsdc === 0) {
        return "BTC";
      }

      // Find asset with maximum negative deviation (most below target).
      // Negative deviation = asset is underweight and needs buying.
      let assetToBuy: AssetSymbol = "BTC";
      let maxNegativeDeviation = 0;

      for (const asset of assets) {
        const currentAllocation = asset.valueInUsdc / totalValueInUsdc;
        const targetAllocation = TARGET_ALLOCATIONS[asset.symbol];
        // deviation < 0 means underweight, deviation > 0 means overweight
        const deviation = currentAllocation - targetAllocation;

        if (deviation < maxNegativeDeviation) {
          maxNegativeDeviation = deviation;
          assetToBuy = asset.symbol;
        }
      }

      return assetToBuy;
    } catch (error) {
      logger.warn("ExecutePurchase", "Failed to calculate allocations, defaulting to BTC", {
        error: error instanceof Error ? error.message : String(error),
      });
      return "BTC";
    }
  }
}
