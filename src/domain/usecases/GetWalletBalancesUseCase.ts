/**
 * Get wallet balances use case
 */

import type { WalletAddress } from "../models/id/index.js";
import { BalanceRepository } from "../repositories/BalanceRepository.js";

export class GetWalletBalancesUseCase {
  constructor(private balanceRepository: BalanceRepository) {}

  /**
   * Fetch SOL and USDC balances for a wallet address.
   * Returns null values if fetch fails.
   */
  async execute(
    address: WalletAddress,
  ): Promise<{ balance: number | null; usdcBalance: number | null }> {
    try {
      const balances = await this.balanceRepository.getBalances(address);
      return { balance: balances.sol, usdcBalance: balances.usdc };
    } catch {
      // Balance fetch failed - wallet may be new or network issue
      return { balance: null, usdcBalance: null };
    }
  }
}
