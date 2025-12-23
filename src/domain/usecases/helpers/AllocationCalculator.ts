/**
 * AllocationCalculator - calculates portfolio allocations and deviations
 *
 * Implements Crypto Majors Index logic:
 * - BTC: 40%
 * - ETH: 30%
 * - SOL: 30%
 *
 * The asset with the most negative deviation is recommended for purchase.
 */

import { AssetSymbol, TARGET_ALLOCATIONS } from "../../../types/portfolio.js";
import { AllocationInfo, PortfolioStatus } from "../../models/PortfolioTypes.js";
import { divideAmount, multiplyAmount, toDecimal, Decimal } from "../../../infrastructure/shared/math/index.js";

export interface AssetBalances {
  btcBalance: number;
  ethBalance: number;
  solBalance: number;
}

export interface AssetPrices {
  BTC: number;
  ETH: number;
  SOL: number;
}

/**
 * Helper class for calculating portfolio allocations
 */
export class AllocationCalculator {
  /**
   * Calculate allocations for given balances and prices
   *
   * Formula for each asset:
   *   valueInUsdc = balance × price
   *   currentAllocation = valueInUsdc / totalPortfolioValue
   *   deviation = currentAllocation - targetAllocation
   */
  static calculateAllocations(
    balances: AssetBalances,
    prices: AssetPrices,
  ): AllocationInfo[] {
    const assets: { symbol: AssetSymbol; balance: number }[] = [
      { symbol: "BTC", balance: balances.btcBalance },
      { symbol: "ETH", balance: balances.ethBalance },
      { symbol: "SOL", balance: balances.solBalance },
    ];

    // Step 1: Calculate USD value of each asset using Decimal for precision
    let totalValueDecimal = toDecimal(0);
    const values: { symbol: AssetSymbol; balance: number; valueInUsdc: Decimal }[] = [];

    for (const asset of assets) {
      const valueInUsdc = multiplyAmount(asset.balance, prices[asset.symbol]);
      totalValueDecimal = totalValueDecimal.plus(valueInUsdc);
      values.push({ ...asset, valueInUsdc });
    }

    // Step 2: Calculate allocation percentage and deviation from target
    return values.map((v) => {
      // Avoid division by zero for empty portfolios
      const currentAllocation = totalValueDecimal.gt(0)
        ? divideAmount(v.valueInUsdc, totalValueDecimal).toNumber()
        : 0;
      const targetAllocation = TARGET_ALLOCATIONS[v.symbol];
      const deviation = currentAllocation - targetAllocation;

      return {
        symbol: v.symbol,
        balance: v.balance,
        valueInUsdc: v.valueInUsdc.toNumber(),
        currentAllocation,
        targetAllocation,
        deviation,
      };
    });
  }

  /**
   * Calculate full portfolio status including asset to buy recommendation
   */
  static calculatePortfolioStatus(
    balances: AssetBalances,
    prices: AssetPrices,
  ): PortfolioStatus {
    const allocations = this.calculateAllocations(balances, prices);
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
   * Select the asset to buy based on current portfolio state
   * Returns the asset that is most below its target allocation
   */
  static selectAssetToBuy(
    balances: AssetBalances,
    prices: AssetPrices,
  ): AssetSymbol {
    const status = this.calculatePortfolioStatus(balances, prices);

    // If portfolio is empty, buy BTC (largest target allocation)
    if (status.totalValueInUsdc === 0) {
      return "BTC";
    }

    return status.assetToBuy;
  }
}
