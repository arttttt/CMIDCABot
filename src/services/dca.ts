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

// Fallback mock prices (USD) - used when PriceService is not available
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

  constructor(
    private userRepository: UserRepository,
    private portfolioRepository: PortfolioRepository,
    private purchaseRepository: PurchaseRepository,
    private solana: SolanaService,
    private isDev: boolean,
    priceService?: PriceService,
  ) {
    this.priceService = priceService ?? null;
  }

  /**
   * Get current prices - uses Jupiter API if PriceService is available, otherwise fallback to mock
   */
  async getCurrentPrices(): Promise<Record<AssetSymbol, number>> {
    if (this.priceService) {
      try {
        return await this.priceService.getPricesRecord();
      } catch (error) {
        console.warn("[DCA] Failed to fetch prices from Jupiter, using fallback:", error);
        return MOCK_PRICES;
      }
    }
    return MOCK_PRICES;
  }

  /**
   * Check if using real prices from Jupiter
   */
  isUsingRealPrices(): boolean {
    return this.priceService !== null;
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
   */
  async getPortfolioStatus(telegramId: number): Promise<PortfolioStatus | null> {
    const portfolio = await this.portfolioRepository.getById(telegramId);
    if (!portfolio) {
      return null;
    }

    const prices = await this.getCurrentPrices();
    const allocations = this.calculateAllocations(portfolio, prices);
    const totalValueInUsdc = allocations.reduce((sum, a) => sum + a.valueInUsdc, 0);

    // Find asset with maximum negative deviation (most below target)
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
   */
  private calculateAllocations(portfolio: PortfolioBalances, prices: Record<AssetSymbol, number>): AllocationInfo[] {
    const assets: { symbol: AssetSymbol; balance: number }[] = [
      { symbol: "BTC", balance: portfolio.btcBalance },
      { symbol: "ETH", balance: portfolio.ethBalance },
      { symbol: "SOL", balance: portfolio.solBalance },
    ];

    // Calculate total value in USDC
    let totalValueInUsdc = 0;
    const values: { symbol: AssetSymbol; balance: number; valueInUsdc: number }[] = [];

    for (const asset of assets) {
      const valueInUsdc = asset.balance * prices[asset.symbol];
      totalValueInUsdc += valueInUsdc;
      values.push({ ...asset, valueInUsdc });
    }

    // Calculate allocations
    return values.map((v) => {
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
      console.log("[DCA] Skipping - not in development mode");
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
        console.log(`[DCA] User ${user.telegramId}: Insufficient balance (${balanceCheck.balance} SOL, need ${requiredSol.toFixed(4)} SOL for ${amountUsdc} USDC)`);
        continue;
      }

      // Execute mock purchase
      const result = await this.executeMockPurchase(user.telegramId, amountUsdc);
      if (result.success) {
        successful++;
        console.log(`[DCA] User ${user.telegramId}: ${result.message}`);
      }
    }

    return { processed, successful };
  }

  /**
   * Execute DCA for active users only (have wallet AND DCA is enabled)
   */
  async executeDcaForActiveUsers(amountUsdc: number): Promise<{ processed: number; successful: number }> {
    if (!this.isMockMode()) {
      console.log("[DCA] Skipping - not in development mode");
      return { processed: 0, successful: 0 };
    }

    const users = await this.userRepository.getAllActiveDcaUsers();
    let processed = 0;
    let successful = 0;

    if (users.length === 0) {
      console.log("[DCA] No active users to process");
      return { processed: 0, successful: 0 };
    }

    // Get current prices for SOL conversion
    const prices = await this.getCurrentPrices();
    const requiredSol = amountUsdc / prices.SOL;

    for (const user of users) {
      processed++;

      // Check balance (but don't deduct in mock mode)
      const balanceCheck = await this.checkSolBalance(user.walletAddress, requiredSol);
      if (!balanceCheck.sufficient) {
        console.log(`[DCA] User ${user.telegramId}: Insufficient balance (${balanceCheck.balance} SOL, need ${requiredSol.toFixed(4)} SOL for ${amountUsdc} USDC)`);
        continue;
      }

      // Execute mock purchase
      const result = await this.executeMockPurchase(user.telegramId, amountUsdc);
      if (result.success) {
        successful++;
        console.log(`[DCA] User ${user.telegramId}: ${result.message}`);
      }
    }

    return { processed, successful };
  }
}
