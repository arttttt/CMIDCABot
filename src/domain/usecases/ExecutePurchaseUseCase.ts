/**
 * Execute purchase use case - real swap via Jupiter
 * Automatically selects the asset furthest below target allocation
 *
 * Streams progress via execute() AsyncGenerator.
 */

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

/**
 * Internal type for asset selection result
 */
interface AssetSelection {
  asset: AssetSymbol;
  currentAllocation: number;
  targetAllocation: number;
  deviation: number;
}

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
    telegramId: number,
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
    let walletAddress: string | undefined;

    if (this.devPrivateKey) {
      walletAddress = await this.blockchainRepository.getAddressFromPrivateKey(this.devPrivateKey);
    } else {
      const user = await this.userRepository.getById(telegramId);
      walletAddress = user?.walletAddress ?? undefined;
    }

    if (!walletAddress) {
      logger.warn("ExecutePurchase", "No wallet connected", { telegramId });
      yield PurchaseSteps.completed({ type: "no_wallet" });
      return;
    }

    // Step: Selecting asset
    yield PurchaseSteps.selectingAsset();

    // Determine which asset to buy based on portfolio allocation
    const selection = await this.selectAssetToBuyWithInfo(walletAddress);
    logger.info("ExecutePurchase", "Selected asset to buy", {
      asset: selection.asset,
      currentAllocation: `${(selection.currentAllocation * 100).toFixed(1)}%`,
      targetAllocation: `${(selection.targetAllocation * 100).toFixed(1)}%`,
      deviation: `${(selection.deviation * 100).toFixed(1)}%`,
    });

    // Step: Asset selected with allocation info
    yield PurchaseSteps.assetSelected({
      asset: selection.asset,
      currentAllocation: selection.currentAllocation,
      targetAllocation: selection.targetAllocation,
      deviation: selection.deviation,
    });

    // Delegate to ExecuteSwapUseCase with progress forwarding
    for await (const swapStep of this.executeSwapUseCase.execute(
      telegramId,
      amountUsdc,
      selection.asset,
    )) {
      if (swapStep.step === "completed") {
        // Map swap result to purchase result
        const purchaseResult = this.mapSwapResultToPurchaseResult(
          swapStep.result,
          selection.asset,
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
        return { type: "send_error", error: swapResult.message };
      case "rpc_error":
        return { type: "rpc_error", error: swapResult.message };
    }
  }

  /**
   * Select asset to buy based on portfolio allocation (with full info)
   *
   * Uses "Crypto Majors Index" rebalancing strategy:
   * - Target: BTC 40%, ETH 30%, SOL 30%
   * - Buys the asset furthest below its target allocation
   *
   * This approach naturally rebalances the portfolio over time:
   * each purchase reduces the deviation of the most underweight asset.
   */
  private async selectAssetToBuyWithInfo(walletAddress: string): Promise<AssetSelection> {
    try {
      // Fetch balances (cached) and prices in parallel for efficiency
      const [balances, prices] = await Promise.all([
        this.balanceRepository.getBalances(walletAddress),
        this.priceRepository!.getPricesRecord(),
      ]);

      // Calculate USD value of each asset holding
      const assets: { symbol: AssetSymbol; valueInUsdc: number }[] = [
        { symbol: "BTC", valueInUsdc: balances.btc * prices.BTC },
        { symbol: "ETH", valueInUsdc: balances.eth * prices.ETH },
        { symbol: "SOL", valueInUsdc: balances.sol * prices.SOL },
      ];

      const totalValueInUsdc = assets.reduce((sum, a) => sum + a.valueInUsdc, 0);

      // Empty portfolio: start with BTC (largest target at 40%)
      if (totalValueInUsdc === 0) {
        return {
          asset: "BTC",
          currentAllocation: 0,
          targetAllocation: TARGET_ALLOCATIONS.BTC,
          deviation: -TARGET_ALLOCATIONS.BTC,
        };
      }

      // Find asset with maximum negative deviation (most below target).
      // Negative deviation = asset is underweight and needs buying.
      let selection: AssetSelection = {
        asset: "BTC",
        currentAllocation: 0,
        targetAllocation: TARGET_ALLOCATIONS.BTC,
        deviation: 0,
      };
      let maxNegativeDeviation = 0;

      for (const asset of assets) {
        const currentAllocation = asset.valueInUsdc / totalValueInUsdc;
        const targetAllocation = TARGET_ALLOCATIONS[asset.symbol];
        // deviation < 0 means underweight, deviation > 0 means overweight
        const deviation = currentAllocation - targetAllocation;

        if (deviation < maxNegativeDeviation) {
          maxNegativeDeviation = deviation;
          selection = {
            asset: asset.symbol,
            currentAllocation,
            targetAllocation,
            deviation,
          };
        }
      }

      return selection;
    } catch (error) {
      logger.warn("ExecutePurchase", "Failed to calculate allocations, defaulting to BTC", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        asset: "BTC",
        currentAllocation: 0,
        targetAllocation: TARGET_ALLOCATIONS.BTC,
        deviation: -TARGET_ALLOCATIONS.BTC,
      };
    }
  }
}
