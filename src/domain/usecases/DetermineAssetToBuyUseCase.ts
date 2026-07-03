/**
 * DetermineAssetToBuyUseCase - determines which asset to buy for portfolio rebalancing
 *
 * Uses AllocationPolicy to determine which asset is furthest below target.
 * This is extracted from ExecutePurchaseUseCase to allow getting asset info
 * before executing the actual purchase (e.g., for quote preview).
 */

import type { TelegramId, WalletAddress } from "../models/id/index.js";
import type { UserRepository } from "../repositories/UserRepository.js";
import type { BalanceRepository } from "../repositories/BalanceRepository.js";
import type { PriceRepository } from "../repositories/PriceRepository.js";
import { AllocationPolicy } from "../policies/AllocationPolicy.js";
import type { AssetAllocation } from "../models/PortfolioTypes.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class DetermineAssetToBuyUseCase {
  constructor(
    private userRepository: UserRepository,
    private balanceRepository: BalanceRepository,
    private priceRepository: PriceRepository,
  ) {}

  /**
   * Determine which asset to buy based on portfolio allocation
   *
   * @param telegramId - User's Telegram ID
   * @returns AssetAllocation with full info, or null if no wallet is connected
   * @throws when balances or prices cannot be fetched — the caller must not
   *         make a purchase decision on incomplete data
   */
  async execute(telegramId: TelegramId): Promise<AssetAllocation | null> {
    const user = await this.userRepository.getById(telegramId);
    const walletAddr: WalletAddress | undefined = user?.walletAddress ?? undefined;

    if (!walletAddr) {
      logger.warn("DetermineAssetToBuy", "No wallet connected", { telegramId });
      return null;
    }

    // Fetch balances and prices in parallel
    const [balances, prices] = await Promise.all([
      this.balanceRepository.getBalances(walletAddr),
      this.priceRepository.getPricesRecord(),
    ]);

    // Calculate portfolio status
    const status = AllocationPolicy.calculatePortfolioStatus(
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

    if (!selectedAllocation) {
      // calculatePortfolioStatus always picks assetToBuy from its own allocations
      throw new Error(`Allocation for selected asset ${status.assetToBuy} not found`);
    }

    logger.info("DetermineAssetToBuy", "Asset determined", {
      symbol: selectedAllocation.symbol,
      currentAllocation: `${(selectedAllocation.currentAllocation * 100).toFixed(1)}%`,
      targetAllocation: `${(selectedAllocation.targetAllocation * 100).toFixed(1)}%`,
    });

    return selectedAllocation;
  }
}
