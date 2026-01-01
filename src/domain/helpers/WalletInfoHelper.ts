/**
 * Helper for getting wallet info
 */

import type { WalletAddress } from "../models/id/index.js";
import { BlockchainRepository } from "../repositories/BlockchainRepository.js";
import { BalanceRepository } from "../repositories/BalanceRepository.js";
import { DcaWalletConfig } from "../../infrastructure/shared/config/index.js";
import { DcaWalletInfo } from "../usecases/types.js";

export class WalletInfoHelper {
  constructor(
    private blockchainRepository: BlockchainRepository,
    private balanceRepository: BalanceRepository,
    private config: DcaWalletConfig,
  ) {}

  isDevMode(): boolean {
    return !!this.config.devPrivateKey;
  }

  /**
   * Get wallet info from plaintext private key.
   * Used for newly created/imported wallets before encryption.
   */
  async getWalletInfo(privateKeyBase64: string, isDevWallet: boolean): Promise<DcaWalletInfo> {
    const address = await this.blockchainRepository.getAddressFromPrivateKey(privateKeyBase64);
    const { balance, usdcBalance } = await this.fetchBalances(address);

    return { address, balance, usdcBalance, isDevWallet };
  }

  /**
   * Get wallet info from address only.
   * Used for existing wallets where we don't want to decrypt the key.
   */
  async getWalletInfoByAddress(address: WalletAddress, isDevWallet: boolean): Promise<DcaWalletInfo> {
    const { balance, usdcBalance } = await this.fetchBalances(address);

    return { address, balance, usdcBalance, isDevWallet };
  }

  /**
   * Fetch SOL and USDC balances for a wallet address.
   * Returns null values if fetch fails.
   */
  private async fetchBalances(address: WalletAddress): Promise<{ balance: number | null; usdcBalance: number | null }> {
    try {
      const balances = await this.balanceRepository.getBalances(address);
      return { balance: balances.sol, usdcBalance: balances.usdc };
    } catch {
      // Balance fetch failed - wallet may be new or network issue
      return { balance: null, usdcBalance: null };
    }
  }

  async getDevWalletInfo(): Promise<DcaWalletInfo> {
    return this.getWalletInfo(this.config.devPrivateKey!, true);
  }

  async getDevWalletAddress(): Promise<WalletAddress | undefined> {
    if (!this.config.devPrivateKey) {
      return undefined;
    }
    return this.blockchainRepository.getAddressFromPrivateKey(this.config.devPrivateKey);
  }
}
