/**
 * Balance Repository Interface
 *
 * Provides access to wallet balances (SOL, BTC, ETH, USDC).
 * Implementation may include caching for performance optimization.
 */
import type { WalletAddress } from "../../types/id/index.js";

/**
 * All asset balances for a wallet
 */
export interface WalletBalances {
  sol: number;
  btc: number;
  eth: number;
  usdc: number;
  fetchedAt: Date;
}

export interface BalanceRepository {
  /**
   * Get all balances for a wallet address
   */
  getBalances(walletAddress: WalletAddress): Promise<WalletBalances>;

  /**
   * Get SOL balance for a wallet
   */
  getSolBalance(walletAddress: WalletAddress): Promise<number>;

  /**
   * Get USDC balance for a wallet
   */
  getUsdcBalance(walletAddress: WalletAddress): Promise<number>;

  /**
   * Invalidate cached balances for a wallet address.
   * Should be called after successful transactions.
   */
  invalidate(walletAddress: WalletAddress): void;
}
