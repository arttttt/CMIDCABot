/**
 * Get portfolio status use case - reads real wallet balances
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { BalanceRepository } from "../repositories/BalanceRepository.js";
import { BlockchainRepository } from "../repositories/BlockchainRepository.js";
import { PriceRepository } from "../repositories/PriceRepository.js";
import { AssetSymbol, TARGET_ALLOCATIONS } from "../../types/portfolio.js";
import { PortfolioStatusResult } from "./types.js";
import { AllocationInfo, PortfolioStatus } from "../models/PortfolioTypes.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class GetPortfolioStatusUseCase {
  constructor(
    private userRepository: UserRepository,
    private balanceRepository: BalanceRepository,
    private blockchainRepository: BlockchainRepository,
    private priceRepository: PriceRepository,
    private devPrivateKey?: string,
  ) {}

  async execute(telegramId: number): Promise<PortfolioStatusResult> {
    logger.info("GetPortfolioStatus", "Fetching portfolio status", { telegramId });

    // Get user's wallet
    let walletAddress: string | undefined;

    if (this.devPrivateKey) {
      // In dev mode, use dev wallet
      walletAddress = await this.blockchainRepository.getAddressFromPrivateKey(this.devPrivateKey);
    } else {
      const user = await this.userRepository.getById(telegramId);
      walletAddress = user?.walletAddress ?? undefined;
    }

    if (!walletAddress) {
      return { type: "not_found" };
    }

    try {
      // Fetch balances (cached) and prices in parallel
      const [balances, prices] = await Promise.all([
        this.balanceRepository.getBalances(walletAddress),
        this.priceRepository.getPricesRecord(),
      ]);

      const { sol: solBalance, btc: btcBalance, eth: ethBalance } = balances;

      logger.debug("GetPortfolioStatus", "Balances fetched", {
        SOL: solBalance,
        BTC: btcBalance,
        ETH: ethBalance,
      });

      // Calculate values in USD
      const assets: { symbol: AssetSymbol; balance: number; valueInUsdc: number }[] = [
        { symbol: "BTC", balance: btcBalance, valueInUsdc: btcBalance * prices.BTC },
        { symbol: "ETH", balance: ethBalance, valueInUsdc: ethBalance * prices.ETH },
        { symbol: "SOL", balance: solBalance, valueInUsdc: solBalance * prices.SOL },
      ];

      const totalValueInUsdc = assets.reduce((sum, a) => sum + a.valueInUsdc, 0);

      // Check if portfolio is empty
      if (totalValueInUsdc === 0) {
        return { type: "empty" };
      }

      // Calculate allocations
      const allocations: AllocationInfo[] = assets.map((asset) => {
        const currentAllocation = totalValueInUsdc > 0 ? asset.valueInUsdc / totalValueInUsdc : 0;
        const targetAllocation = TARGET_ALLOCATIONS[asset.symbol];
        const deviation = currentAllocation - targetAllocation;

        return {
          symbol: asset.symbol,
          balance: asset.balance,
          valueInUsdc: asset.valueInUsdc,
          currentAllocation,
          targetAllocation,
          deviation,
        };
      });

      // Find asset with maximum negative deviation (most below target)
      let assetToBuy: AssetSymbol = "BTC";
      let maxDeviation = 0;

      for (const alloc of allocations) {
        if (alloc.deviation < maxDeviation) {
          maxDeviation = alloc.deviation;
          assetToBuy = alloc.symbol;
        }
      }

      const status: PortfolioStatus = {
        allocations,
        totalValueInUsdc,
        assetToBuy,
        maxDeviation,
      };

      logger.info("GetPortfolioStatus", "Portfolio status calculated", {
        totalValue: `$${totalValueInUsdc.toFixed(2)}`,
        nextBuy: assetToBuy,
      });

      return { type: "success", status };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("GetPortfolioStatus", "Failed to fetch portfolio", { error: errorMessage });
      return { type: "error", error: errorMessage };
    }
  }
}
