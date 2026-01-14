/**
 * Get wallet info by private key use case
 */

import type { WalletAddress } from "../models/id/index.js";
import { BalanceRepository } from "../repositories/BalanceRepository.js";
import { BlockchainRepository } from "../repositories/BlockchainRepository.js";
import type { DcaWalletInfo } from "./types.js";

export class GetWalletInfoByPrivateKeyUseCase {
  constructor(
    private blockchainRepository: BlockchainRepository,
    private balanceRepository: BalanceRepository,
  ) {}

  /**
   * Get wallet info from plaintext private key.
   * Used for newly created/imported wallets before encryption.
   */
  async execute(privateKeyBase64: string, isDevWallet: boolean): Promise<DcaWalletInfo> {
    const address = await this.blockchainRepository.getAddressFromPrivateKey(privateKeyBase64);
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
