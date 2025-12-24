/**
 * Get portfolio status use case - reads real wallet balances
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { BalanceRepository } from "../repositories/BalanceRepository.js";
import { BlockchainRepository } from "../repositories/BlockchainRepository.js";
import { PriceRepository } from "../repositories/PriceRepository.js";
import { PortfolioStatusResult } from "./types.js";
import { PortfolioStatus } from "../models/PortfolioTypes.js";
import { logger } from "../../infrastructure/shared/logging/index.js";
import { AllocationCalculator } from "../helpers/AllocationCalculator.js";

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

      // Calculate portfolio status using AllocationCalculator
      const status: PortfolioStatus = AllocationCalculator.calculatePortfolioStatus(
        { btcBalance, ethBalance, solBalance },
        prices,
      );

      // Check if portfolio is empty
      if (status.totalValueInUsdc === 0) {
        return { type: "empty" };
      }

      logger.info("GetPortfolioStatus", "Portfolio status calculated", {
        totalValue: `$${status.totalValueInUsdc.toFixed(2)}`,
        nextBuy: status.assetToBuy,
      });

      return { type: "success", status };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("GetPortfolioStatus", "Failed to fetch portfolio", { error: errorMessage });
      return { type: "error", error: errorMessage };
    }
  }
}
