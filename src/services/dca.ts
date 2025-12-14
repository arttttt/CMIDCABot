/**
 * DCA Service - Portfolio management for DCA investing
 * Supports both mock prices (development) and real Jupiter prices (production)
 */

import { UserRepository } from "../domain/repositories/UserRepository.js";
import { PortfolioRepository } from "../domain/repositories/PortfolioRepository.js";
import { PurchaseRepository } from "../domain/repositories/PurchaseRepository.js";
import { PortfolioBalances } from "../domain/models/Portfolio.js";
import { SolanaService } from "./solana.js";
import { PriceService } from "./price.js";
import { AssetSymbol, TARGET_ALLOCATIONS } from "../types/portfolio.js";
import { PriceSource } from "../types/config.js";
import { logger } from "./logger.js";

// Mock prices (USD) - used when PRICE_SOURCE=mock
export const MOCK_PRICES: Record<AssetSymbol, number> = {
  BTC: 100000,
  ETH: 3500,
  SOL: 200,
};

export interface AllocationInfo {
  symbol: AssetSymbol;
  balance: number;
  valueInUsdc: number;
  currentAllocation: number;
  targetAllocation: number;
  deviation: number; // negative = below target
}

export interface PortfolioStatus {
  allocations: AllocationInfo[];
  totalValueInUsdc: number;
  assetToBuy: AssetSymbol;
  maxDeviation: number;
}

export class DcaService {
  private priceService: PriceService | null;
  private priceSource: PriceSource;

  constructor(
    private userRepository: UserRepository,
    private portfolioRepository: PortfolioRepository,
    private purchaseRepository: PurchaseRepository,
    private solana: SolanaService,
    private isDev: boolean,
    priceSource: PriceSource,
    priceService?: PriceService,
  ) {
    this.priceSource = priceSource;
    this.priceService = priceSource === "jupiter" ? (priceService ?? null) : null;
  }

  /**
   * Get current prices based on configured source (jupiter or mock)
   */
  async getCurrentPrices(): Promise<Record<AssetSymbol, number>> {
    if (this.priceSource === "jupiter" && this.priceService) {
      return await this.priceService.getPricesRecord();
    }
    return MOCK_PRICES;
  }

  /**
   * Get price source type
   */
  getPriceSource(): PriceSource {
    return this.priceSource;
  }

  /**
   * Check if using real prices from Jupiter
   */
  isUsingRealPrices(): boolean {
    return this.priceSource === "jupiter";
  }

  /**
   * Check if mock mode is active (only in development)
   */
  isMockMode(): boolean {
    return this.isDev;
  }

  /**
   * Create portfolio for user (in mock database)
   */
  async createPortfolio(telegramId: number): Promise<void> {
    await this.portfolioRepository.create(telegramId);
  }

  /**
   * Reset portfolio - clear all balances and purchase history
   */
  async resetPortfolio(telegramId: number): Promise<void> {
    await this.portfolioRepository.reset(telegramId);
    await this.purchaseRepository.deleteByUserId(telegramId);
  }

  /**
   * Get portfolio status with allocations and deviation analysis
   *
   * Deviation = currentAllocation - targetAllocation
   *   - Negative deviation means asset is BELOW target (needs buying)
   *   - Positive deviation means asset is ABOVE target (overweight)
   *
   * The asset with the most negative deviation is selected for the next purchase.
   */
  async getPortfolioStatus(telegramId: number): Promise<PortfolioStatus | null> {
    const portfolio = await this.portfolioRepository.getById(telegramId);
    if (!portfolio) {
      return null;
    }

    const prices = await this.getCurrentPrices();
    const allocations = this.calculateAllocations(portfolio, prices);
    const totalValueInUsdc = allocations.reduce((sum, a) => sum + a.valueInUsdc, 0);

    // Find asset with maximum negative deviation (most below target).
    // Example: BTC target 40%, current 30% → deviation -10%
    //          ETH target 30%, current 35% → deviation +5%
    //          SOL target 30%, current 35% → deviation +5%
    // Result: Buy BTC (deviation -10% is most negative)
    let assetToBuy: AssetSymbol = "BTC";
    let maxDeviation = 0;

    for (const alloc of allocations) {
      if (alloc.deviation < maxDeviation) {
        maxDeviation = alloc.deviation;
        assetToBuy = alloc.symbol;
      }
    }

    return {
      allocations,
      totalValueInUsdc,
      assetToBuy,
      maxDeviation,
    };
  }

  /**
   * Calculate current allocations vs target
   *
   * Formula for each asset:
   *   valueInUsdc = balance × price
   *   currentAllocation = valueInUsdc / totalPortfolioValue
   *   deviation = currentAllocation - targetAllocation
   *
   * Crypto Majors Index target allocations: BTC 40%, ETH 30%, SOL 30%
   */
  private calculateAllocations(portfolio: PortfolioBalances, prices: Record<AssetSymbol, number>): AllocationInfo[] {
    const assets: { symbol: AssetSymbol; balance: number }[] = [
      { symbol: "BTC", balance: portfolio.btcBalance },
      { symbol: "ETH", balance: portfolio.ethBalance },
      { symbol: "SOL", balance: portfolio.solBalance },
    ];

    // Step 1: Calculate USD value of each asset
    let totalValueInUsdc = 0;
    const values: { symbol: AssetSymbol; balance: number; valueInUsdc: number }[] = [];

    for (const asset of assets) {
      const valueInUsdc = asset.balance * prices[asset.symbol];
      totalValueInUsdc += valueInUsdc;
      values.push({ ...asset, valueInUsdc });
    }

    // Step 2: Calculate allocation percentage and deviation from target
    return values.map((v) => {
      // Avoid division by zero for empty portfolios
      const currentAllocation = totalValueInUsdc > 0 ? v.valueInUsdc / totalValueInUsdc : 0;
      const targetAllocation = TARGET_ALLOCATIONS[v.symbol];
      const deviation = currentAllocation - targetAllocation;

      return {
        symbol: v.symbol,
        balance: v.balance,
        valueInUsdc: v.valueInUsdc,
        currentAllocation,
        targetAllocation,
        deviation,
      };
    });
  }

  /**
   * Determine which asset to buy based on maximum deviation from target
   */
  async selectAssetToBuy(telegramId: number): Promise<AssetSymbol> {
    const status = await this.getPortfolioStatus(telegramId);
    if (!status) {
      // New portfolio - start with BTC (largest target)
      return "BTC";
    }

    // If portfolio is empty, buy the one with largest target allocation
    if (status.totalValueInUsdc === 0) {
      return "BTC";
    }

    return status.assetToBuy;
  }

  /**
   * Execute a mock purchase - updates portfolio without real swap
   */
  async executeMockPurchase(
    telegramId: number,
    amountUsdc: number,
    asset?: AssetSymbol,
  ): Promise<{ success: boolean; asset: AssetSymbol; amount: number; priceUsd: number; message: string }> {
    if (!this.isMockMode()) {
      return {
        success: false,
        asset: "BTC",
        amount: 0,
        priceUsd: 0,
        message: "Mock purchases only available in development mode",
      };
    }

    // Ensure portfolio exists
    await this.portfolioRepository.create(telegramId);

    // Select asset if not specified
    const selectedAsset = asset || await this.selectAssetToBuy(telegramId);

    // Get current prices (real or mock)
    const prices = await this.getCurrentPrices();

    // Calculate amount of asset to receive (amountUsdc / price in USD)
    const priceUsd = prices[selectedAsset];
    const amountAsset = amountUsdc / priceUsd;

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

    const priceSource = this.isUsingRealPrices() ? "Jupiter" : "mock";
    return {
      success: true,
      asset: selectedAsset,
      amount: amountAsset,
      priceUsd,
      message: `Purchased ${amountAsset.toFixed(8)} ${selectedAsset} for ${amountUsdc} USDC @ $${priceUsd.toFixed(2)} (${priceSource})`,
    };
  }

  /**
   * Check if user has sufficient SOL balance (without deducting)
   */
  async checkSolBalance(walletAddress: string, requiredSol: number): Promise<{ sufficient: boolean; balance: number }> {
    try {
      const balance = await this.solana.getBalance(walletAddress);
      return {
        sufficient: balance >= requiredSol,
        balance,
      };
    } catch {
      return {
        sufficient: false,
        balance: 0,
      };
    }
  }

  /**
   * Execute DCA for all users with wallets (scheduled task)
   * @deprecated Use executeDcaForActiveUsers instead
   */
  async executeDcaForAllUsers(amountUsdc: number): Promise<{ processed: number; successful: number }> {
    if (!this.isMockMode()) {
      logger.debug("DcaService", "Skipping - not in development mode");
      return { processed: 0, successful: 0 };
    }

    const users = await this.userRepository.getAllWithWallet();
    let processed = 0;
    let successful = 0;

    // Get current prices for SOL conversion
    const prices = await this.getCurrentPrices();
    const requiredSol = amountUsdc / prices.SOL;

    for (const user of users) {
      processed++;

      // Check balance (but don't deduct in mock mode)
      const balanceCheck = await this.checkSolBalance(user.walletAddress, requiredSol);
      if (!balanceCheck.sufficient) {
        logger.warn("DcaService", "Insufficient balance", {
          telegramId: user.telegramId,
          balance: balanceCheck.balance,
          required: requiredSol,
        });
        continue;
      }

      // Execute mock purchase
      const result = await this.executeMockPurchase(user.telegramId, amountUsdc);
      if (result.success) {
        successful++;
        logger.info("DcaService", "Mock purchase executed", {
          telegramId: user.telegramId,
          asset: result.asset,
          amount: result.amount,
        });
      }
    }

    return { processed, successful };
  }

  /**
   * Execute DCA for active users only (have wallet AND DCA is enabled)
   */
  async executeDcaForActiveUsers(amountUsdc: number): Promise<{ processed: number; successful: number }> {
    if (!this.isMockMode()) {
      logger.debug("DcaService", "Skipping - not in development mode");
      return { processed: 0, successful: 0 };
    }

    const users = await this.userRepository.getAllActiveDcaUsers();
    let processed = 0;
    let successful = 0;

    if (users.length === 0) {
      logger.debug("DcaService", "No active users to process");
      return { processed: 0, successful: 0 };
    }

    logger.info("DcaService", "Processing active users", { count: users.length });

    // Get current prices for SOL conversion
    const prices = await this.getCurrentPrices();
    const requiredSol = amountUsdc / prices.SOL;

    for (const user of users) {
      processed++;

      // Check balance (but don't deduct in mock mode)
      const balanceCheck = await this.checkSolBalance(user.walletAddress, requiredSol);
      if (!balanceCheck.sufficient) {
        logger.warn("DcaService", "Insufficient balance", {
          telegramId: user.telegramId,
          balance: balanceCheck.balance,
          required: requiredSol,
        });
        continue;
      }

      // Execute mock purchase
      const result = await this.executeMockPurchase(user.telegramId, amountUsdc);
      if (result.success) {
        successful++;
        logger.info("DcaService", "Mock purchase executed", {
          telegramId: user.telegramId,
          asset: result.asset,
          amount: result.amount,
        });
      }
    }

    return { processed, successful };
  }
}
