/**
 * Get wallet info by address use case
 */

import type { WalletAddress } from "../models/id/index.js";
import { BalanceRepository } from "../repositories/BalanceRepository.js";
import type { DcaWalletInfo } from "./types.js";

export class GetWalletInfoByAddressUseCase {
  constructor(
    private balanceRepository: BalanceRepository,
  ) {}

  /**
   * Get wallet info from address only.
   * Used for existing wallets where we don't want to decrypt the key.
   */
  async execute(address: WalletAddress, isDevWallet: boolean): Promise<DcaWalletInfo> {
    const { balance, usdcBalance } = await this.fetchBalances(address);

    return { address, balance, usdcBalance, isDevWallet };
  }

  /**
   * Fetch SOL and USDC balances for a wallet address.
   * Returns null values if fetch fails.
   */
  private async fetchBalances(
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
