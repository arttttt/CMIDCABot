/**
 * DetermineAssetToBuyUseCase - determines which asset to buy for portfolio rebalancing
 *
 * Uses AllocationCalculator to determine which asset is furthest below target.
 * This is extracted from ExecutePurchaseUseCase to allow getting asset info
 * before executing the actual purchase (e.g., for quote preview).
 */

import type { TelegramId, WalletAddress } from "../models/id/index.js";
import type { UserRepository } from "../repositories/UserRepository.js";
import type { BalanceRepository } from "../repositories/BalanceRepository.js";
import type { BlockchainRepository } from "../repositories/BlockchainRepository.js";
import type { PriceRepository } from "../repositories/PriceRepository.js";
import { TARGET_ALLOCATIONS } from "../../types/portfolio.js";
import { AllocationCalculator } from "../helpers/AllocationCalculator.js";
import type { AssetAllocation } from "../models/PortfolioTypes.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class DetermineAssetToBuyUseCase {
  constructor(
    private userRepository: UserRepository,
    private balanceRepository: BalanceRepository,
    private blockchainRepository: BlockchainRepository,
    private priceRepository: PriceRepository,
    private devPrivateKey?: string,
  ) {}

  /**
   * Determine which asset to buy based on portfolio allocation
   *
   * @param telegramId - User's Telegram ID
   * @returns AssetAllocation with full info, or null if unable to determine
   */
  async execute(telegramId: TelegramId): Promise<AssetAllocation | null> {
    // Get wallet address
    let walletAddr: WalletAddress | undefined;

    if (this.devPrivateKey) {
      walletAddr = await this.blockchainRepository.getAddressFromPrivateKey(
        this.devPrivateKey,
      );
    } else {
      const user = await this.userRepository.getById(telegramId);
      walletAddr = user?.walletAddress ?? undefined;
    }

    if (!walletAddr) {
      logger.warn("DetermineAssetToBuy", "No wallet connected", { telegramId });
      return null;
    }

    try {
      // Fetch balances and prices in parallel
      const [balances, prices] = await Promise.all([
        this.balanceRepository.getBalances(walletAddr),
        this.priceRepository.getPricesRecord(),
      ]);

      // Calculate portfolio status
      const status = AllocationCalculator.calculatePortfolioStatus(
        {
          btcBalance: balances.btc,
          ethBalance: balances.eth,
          solBalance: balances.sol,
        },
        prices,
      );

      // Find the allocation info for the asset to buy
      const selectedAllocation = status.allocations.find(
        (a) => a.symbol === status.assetToBuy,
      );

      logger.info("DetermineAssetToBuy", "Asset determined", {
        symbol: selectedAllocation?.symbol ?? "SOL",
        currentAllocation: selectedAllocation
          ? `${(selectedAllocation.currentAllocation * 100).toFixed(1)}%`
          : "0%",
        targetAllocation: selectedAllocation
          ? `${(selectedAllocation.targetAllocation * 100).toFixed(1)}%`
          : `${(TARGET_ALLOCATIONS.SOL * 100).toFixed(1)}%`,
      });

      return selectedAllocation ?? this.getDefaultAllocation();
    } catch (error) {
      logger.warn(
        "DetermineAssetToBuy",
        "Failed to calculate allocations, defaulting to SOL",
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return this.getDefaultAllocation();
    }
  }

  /**
   * Get default allocation info for SOL (used when calculation fails)
   */
  private getDefaultAllocation(): AssetAllocation {
    return {
      symbol: "SOL",
      balance: 0,
      valueInUsdc: 0,
      currentAllocation: 0,
      targetAllocation: TARGET_ALLOCATIONS.SOL,
      deviation: -TARGET_ALLOCATIONS.SOL,
    };
  }
}
