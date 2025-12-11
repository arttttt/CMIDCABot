/**
 * DCA Service - Mock portfolio management for development/testing
 * Works only in NODE_ENV=development
 */

import { UserRepository } from "../domain/repositories/UserRepository.js";
import { PortfolioRepository } from "../domain/repositories/PortfolioRepository.js";
import { PurchaseRepository } from "../domain/repositories/PurchaseRepository.js";
import { PortfolioBalances } from "../domain/models/Portfolio.js";
import { SolanaService } from "./solana.js";
import { AssetSymbol, TARGET_ALLOCATIONS } from "../types/portfolio.js";

// Hardcoded mock prices (USD) - no real API calls
export const MOCK_PRICES: Record<AssetSymbol, number> = {
  BTC: 100000,
  ETH: 3500,
  SOL: 200,
};

// Price ratios relative to SOL
export const PRICE_IN_SOL: Record<AssetSymbol, number> = {
  BTC: MOCK_PRICES.BTC / MOCK_PRICES.SOL, // 500 SOL per BTC
  ETH: MOCK_PRICES.ETH / MOCK_PRICES.SOL, // 17.5 SOL per ETH
  SOL: 1, // 1 SOL per SOL
};

export interface AllocationInfo {
  symbol: AssetSymbol;
  balance: number;
  valueInSol: number;
  currentAllocation: number;
  targetAllocation: number;
  deviation: number; // negative = below target
}

export interface PortfolioStatus {
  allocations: AllocationInfo[];
  totalValueInSol: number;
  assetToBuy: AssetSymbol;
  maxDeviation: number;
}

export class DcaService {
  constructor(
    private userRepository: UserRepository,
    private portfolioRepository: PortfolioRepository,
    private purchaseRepository: PurchaseRepository,
    private solana: SolanaService,
    private isDev: boolean,
  ) {}

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

    const allocations = this.calculateAllocations(portfolio);
    const totalValueInSol = allocations.reduce((sum, a) => sum + a.valueInSol, 0);

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
      totalValueInSol,
      assetToBuy,
      maxDeviation,
    };
  }

  /**
   * Calculate current allocations vs target
   */
  private calculateAllocations(portfolio: PortfolioBalances): AllocationInfo[] {
    const assets: { symbol: AssetSymbol; balance: number }[] = [
      { symbol: "BTC", balance: portfolio.btcBalance },
      { symbol: "ETH", balance: portfolio.ethBalance },
      { symbol: "SOL", balance: portfolio.solBalance },
    ];

    // Calculate total value in SOL
    let totalValueInSol = 0;
    const values: { symbol: AssetSymbol; balance: number; valueInSol: number }[] = [];

    for (const asset of assets) {
      const valueInSol = asset.balance * PRICE_IN_SOL[asset.symbol];
      totalValueInSol += valueInSol;
      values.push({ ...asset, valueInSol });
    }

    // Calculate allocations
    return values.map((v) => {
      const currentAllocation = totalValueInSol > 0 ? v.valueInSol / totalValueInSol : 0;
      const targetAllocation = TARGET_ALLOCATIONS[v.symbol];
      const deviation = currentAllocation - targetAllocation;

      return {
        symbol: v.symbol,
        balance: v.balance,
        valueInSol: v.valueInSol,
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
    if (status.totalValueInSol === 0) {
      return "BTC";
    }

    return status.assetToBuy;
  }

  /**
   * Execute a mock purchase - updates portfolio without real swap
   */
  async executeMockPurchase(
    telegramId: number,
    amountSol: number,
    asset?: AssetSymbol,
  ): Promise<{ success: boolean; asset: AssetSymbol; amount: number; message: string }> {
    if (!this.isMockMode()) {
      return {
        success: false,
        asset: "BTC",
        amount: 0,
        message: "Mock purchases only available in development mode",
      };
    }

    // Ensure portfolio exists
    await this.portfolioRepository.create(telegramId);

    // Select asset if not specified
    const selectedAsset = asset || await this.selectAssetToBuy(telegramId);

    // Calculate amount of asset to receive
    const amountAsset = amountSol / PRICE_IN_SOL[selectedAsset];
    const priceUsd = MOCK_PRICES[selectedAsset];

    // Update portfolio balance
    await this.portfolioRepository.updateBalance(telegramId, selectedAsset, amountAsset);

    // Record the purchase
    await this.purchaseRepository.create({
      telegramId,
      assetSymbol: selectedAsset,
      amountSol,
      amountAsset,
      priceUsd,
    });

    return {
      success: true,
      asset: selectedAsset,
      amount: amountAsset,
      message: `Mock purchased ${amountAsset.toFixed(8)} ${selectedAsset} for ${amountSol} SOL`,
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
   */
  async executeDcaForAllUsers(amountSol: number): Promise<{ processed: number; successful: number }> {
    if (!this.isMockMode()) {
      console.log("[DCA] Skipping - not in development mode");
      return { processed: 0, successful: 0 };
    }

    const users = await this.userRepository.getAllWithWallet();
    let processed = 0;
    let successful = 0;

    for (const user of users) {
      processed++;

      // Check balance (but don't deduct in mock mode)
      const balanceCheck = await this.checkSolBalance(user.walletAddress, amountSol);
      if (!balanceCheck.sufficient) {
        console.log(`[DCA] User ${user.telegramId}: Insufficient balance (${balanceCheck.balance} SOL)`);
        continue;
      }

      // Execute mock purchase
      const result = await this.executeMockPurchase(user.telegramId, amountSol);
      if (result.success) {
        successful++;
        console.log(`[DCA] User ${user.telegramId}: ${result.message}`);
      }
    }

    return { processed, successful };
  }
}
