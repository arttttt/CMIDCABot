/**
 * Execute purchase use case - real swap via Jupiter
 * Automatically selects the asset furthest below target allocation
 *
 * Streams progress via execute() AsyncGenerator.
 */

import type { TelegramId, WalletAddress } from "../models/id/index.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { BalanceRepository } from "../repositories/BalanceRepository.js";
import { BlockchainRepository } from "../repositories/BlockchainRepository.js";
import { PriceRepository } from "../repositories/PriceRepository.js";
import { AssetSymbol, TARGET_ALLOCATIONS } from "../../types/portfolio.js";
import { PurchaseResult } from "./types.js";
import { ExecuteSwapUseCase } from "./ExecuteSwapUseCase.js";
import { SwapResult } from "../models/SwapStep.js";
import { logger } from "../../infrastructure/shared/logging/index.js";
import { PurchaseStep, PurchaseSteps } from "../models/index.js";
import { AllocationCalculator } from "../helpers/AllocationCalculator.js";
import { AssetAllocation } from "../models/PortfolioTypes.js";

export class ExecutePurchaseUseCase {
  constructor(
    private userRepository: UserRepository,
    private balanceRepository: BalanceRepository,
    private executeSwapUseCase: ExecuteSwapUseCase,
    private blockchainRepository: BlockchainRepository,
    private priceRepository: PriceRepository | undefined,
    private devPrivateKey?: string,
  ) {}

  /**
   * Execute purchase with streaming progress
   * @param telegramId User's Telegram ID
   * @param amountUsdc Amount of USDC to spend
   * @yields PurchaseStep - progress updates and final result
   */
  async *execute(
    telegramId: TelegramId,
    amountUsdc: number,
  ): AsyncGenerator<PurchaseStep> {
    logger.info("ExecutePurchase", "Executing portfolio purchase", {
      telegramId,
      amountUsdc,
    });

    // Check if PriceRepository is available (needed for selectAssetToBuy)
    if (!this.priceRepository) {
      logger.warn("ExecutePurchase", "Price repository unavailable");
      yield PurchaseSteps.completed({ type: "unavailable" });
      return;
    }

    // Validate amount
    if (isNaN(amountUsdc) || amountUsdc <= 0) {
      logger.warn("ExecutePurchase", "Invalid amount", { amountUsdc });
      yield PurchaseSteps.completed({ type: "invalid_amount" });
      return;
    }

    if (amountUsdc < 0.01) {
      yield PurchaseSteps.completed({
        type: "invalid_amount",
        error: "Minimum amount is 0.01 USDC",
      });
      return;
    }

    // Get wallet address for portfolio selection
    let walletAddr: WalletAddress | undefined;

    if (this.devPrivateKey) {
      walletAddr = await this.blockchainRepository.getAddressFromPrivateKey(this.devPrivateKey);
    } else {
      const user = await this.userRepository.getById(telegramId);
      walletAddr = user?.walletAddress ?? undefined;
    }

    if (!walletAddr) {
      logger.warn("ExecutePurchase", "No wallet connected", { telegramId });
      yield PurchaseSteps.completed({ type: "no_wallet" });
      return;
    }

    // Pre-validate USDC balance before asset selection (early-exit)
    yield PurchaseSteps.checkingBalance();

    let usdcBalance: number;
    try {
      usdcBalance = await this.balanceRepository.getUsdcBalance(walletAddr);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("ExecutePurchase", "Failed to fetch USDC balance", { error: message });
      yield PurchaseSteps.completed({ type: "rpc_error", error: message });
      return;
    }

    if (usdcBalance < amountUsdc) {
      logger.warn("ExecutePurchase", "Insufficient USDC balance", {
        required: amountUsdc,
        available: usdcBalance,
      });
      yield PurchaseSteps.completed({
        type: "insufficient_balance",
        requiredBalance: amountUsdc,
        availableBalance: usdcBalance,
      });
      return;
    }

    // Step: Selecting asset
    yield PurchaseSteps.selectingAsset();

    // Determine which asset to buy based on portfolio allocation
    const selection = await this.selectAssetToBuyWithInfo(walletAddr);
    logger.info("ExecutePurchase", "Selected asset to buy", {
      symbol: selection.symbol,
      currentAllocation: `${(selection.currentAllocation * 100).toFixed(1)}%`,
      targetAllocation: `${(selection.targetAllocation * 100).toFixed(1)}%`,
      deviation: `${(selection.deviation * 100).toFixed(1)}%`,
    });

    // Step: Asset selected with allocation info
    yield PurchaseSteps.assetSelected(selection);

    // Delegate to ExecuteSwapUseCase with progress forwarding
    for await (const swapStep of this.executeSwapUseCase.execute(
      telegramId,
      amountUsdc,
      selection.symbol,
    )) {
      if (swapStep.step === "completed") {
        // Map swap result to purchase result
        const purchaseResult = this.mapSwapResultToPurchaseResult(
          swapStep.result,
          selection.symbol,
          amountUsdc,
        );
        yield PurchaseSteps.completed(purchaseResult);
      } else {
        // Wrap swap step in purchase step
        yield PurchaseSteps.swap(swapStep);
      }
    }
  }

  /**
   * Map SwapResult to PurchaseResult
   */
  private mapSwapResultToPurchaseResult(
    swapResult: SwapResult,
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
        return { type: "send_error", error: swapResult.message, signature: swapResult.signature };
      case "rpc_error":
        return { type: "rpc_error", error: swapResult.message };
    }
  }

  /**
   * Select asset to buy based on portfolio allocation (with full info)
   *
   * Uses AllocationCalculator to determine which asset is furthest below target.
   */
  private async selectAssetToBuyWithInfo(walletAddr: WalletAddress): Promise<AssetAllocation> {
    try {
      // Fetch balances (cached) and prices in parallel for efficiency
      const [balances, prices] = await Promise.all([
        this.balanceRepository.getBalances(walletAddr),
        this.priceRepository!.getPricesRecord(),
      ]);

      // Calculate portfolio status using AllocationCalculator
      const status = AllocationCalculator.calculatePortfolioStatus(
        { btcBalance: balances.btc, ethBalance: balances.eth, solBalance: balances.sol },
        prices,
      );

      // Find the allocation info for the asset to buy
      const selectedAllocation = status.allocations.find(
        (a) => a.symbol === status.assetToBuy,
      );

      // Should always find it, but fallback to BTC if not
      return selectedAllocation ?? this.getDefaultAllocation();
    } catch (error) {
      logger.warn("ExecutePurchase", "Failed to calculate allocations, defaulting to BTC", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getDefaultAllocation();
    }
  }

  /**
   * Get default allocation info for BTC (used when calculation fails)
   */
  private getDefaultAllocation(): AssetAllocation {
    return {
      symbol: "BTC",
      balance: 0,
      valueInUsdc: 0,
      currentAllocation: 0,
      targetAllocation: TARGET_ALLOCATIONS.BTC,
      deviation: -TARGET_ALLOCATIONS.BTC,
    };
  }
}
