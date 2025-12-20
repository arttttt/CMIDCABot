/**
 * Execute purchase use case - real swap via Jupiter
 * Automatically selects the asset furthest below target allocation
 *
 * Supports streaming progress via executeWithProgress() AsyncGenerator.
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { BalanceRepository } from "../repositories/BalanceRepository.js";
import { SolanaService } from "../../services/solana.js";
import { PriceService } from "../../services/price.js";
import { AssetSymbol, TARGET_ALLOCATIONS } from "../../types/portfolio.js";
import { PurchaseResult } from "./types.js";
import { ExecuteSwapUseCase, ExecuteSwapResult } from "./ExecuteSwapUseCase.js";
import { logger } from "../../services/logger.js";
import {
  OperationState,
  PurchaseStep,
  PurchaseSteps,
  progress,
  completed,
} from "../models/index.js";

/**
 * Type alias for purchase operation state stream
 */
export type PurchaseState = OperationState<PurchaseStep, PurchaseResult>;

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
    private solanaService: SolanaService,
    private priceService: PriceService | undefined,
    private devPrivateKey?: string,
  ) {}

  /**
   * Execute purchase (non-streaming)
   */
  async execute(telegramId: number, amountUsdc: number): Promise<PurchaseResult> {
    // Consume the generator and return final result
    let result: PurchaseResult = { type: "unavailable" };
    for await (const state of this.executeWithProgress(telegramId, amountUsdc)) {
      if (state.type === "completed") {
        result = state.result;
      }
    }
    return result;
  }

  /**
   * Execute purchase with streaming progress
   * @param telegramId User's Telegram ID
   * @param amountUsdc Amount of USDC to spend
   * @yields PurchaseState - progress updates and final result
   */
  async *executeWithProgress(
    telegramId: number,
    amountUsdc: number,
  ): AsyncGenerator<PurchaseState> {
    logger.info("ExecutePurchase", "Executing portfolio purchase", {
      telegramId,
      amountUsdc,
    });

    // Check if PriceService is available (needed for selectAssetToBuy)
    if (!this.priceService) {
      logger.warn("ExecutePurchase", "Price service unavailable");
      yield completed({ type: "unavailable" });
      return;
    }

    // Validate amount
    if (isNaN(amountUsdc) || amountUsdc <= 0) {
      logger.warn("ExecutePurchase", "Invalid amount", { amountUsdc });
      yield completed({ type: "invalid_amount" });
      return;
    }

    if (amountUsdc < 0.01) {
      yield completed({
        type: "invalid_amount",
        error: "Minimum amount is 0.01 USDC",
      });
      return;
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
      yield completed({ type: "no_wallet" });
      return;
    }

    // Step: Selecting asset
    yield progress(PurchaseSteps.selectingAsset());

    // Determine which asset to buy based on portfolio allocation
    const selection = await this.selectAssetToBuyWithInfo(walletAddress);
    logger.info("ExecutePurchase", "Selected asset to buy", {
      asset: selection.asset,
      currentAllocation: `${(selection.currentAllocation * 100).toFixed(1)}%`,
      targetAllocation: `${(selection.targetAllocation * 100).toFixed(1)}%`,
      deviation: `${(selection.deviation * 100).toFixed(1)}%`,
    });

    // Step: Asset selected with allocation info
    yield progress(
      PurchaseSteps.assetSelected({
        asset: selection.asset,
        currentAllocation: selection.currentAllocation,
        targetAllocation: selection.targetAllocation,
        deviation: selection.deviation,
      }),
    );

    // Delegate to ExecuteSwapUseCase with progress forwarding
    for await (const swapState of this.executeSwapUseCase.executeWithProgress(
      telegramId,
      amountUsdc,
      selection.asset,
    )) {
      if (swapState.type === "progress") {
        // Wrap swap step in purchase step
        yield progress(PurchaseSteps.swap(swapState.step));
      } else {
        // Map swap result to purchase result
        const purchaseResult = this.mapSwapResultToPurchaseResult(
          swapState.result,
          selection.asset,
          amountUsdc,
        );
        yield completed(purchaseResult);
      }
    }
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
        this.priceService!.getPricesRecord(),
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
