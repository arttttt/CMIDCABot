/**
 * Helper for getting wallet info
 */

import { BlockchainRepository } from "../../repositories/BlockchainRepository.js";
import { DcaWalletConfig } from "../../../types/config.js";
import { DcaWalletInfo } from "../types.js";

export class WalletInfoHelper {
  constructor(
    private blockchainRepository: BlockchainRepository,
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

    let balance: number | null = null;
    try {
      balance = await this.blockchainRepository.getBalance(address);
    } catch {
      // Balance fetch failed - wallet may be new or network issue
    }

    return { address, balance, isDevWallet };
  }

  /**
   * Get wallet info from address only.
   * Used for existing wallets where we don't want to decrypt the key.
   */
  async getWalletInfoByAddress(address: string, isDevWallet: boolean): Promise<DcaWalletInfo> {
    let balance: number | null = null;
    try {
      balance = await this.blockchainRepository.getBalance(address);
    } catch {
      // Balance fetch failed - wallet may be new or network issue
    }

    return { address, balance, isDevWallet };
  }

  async getDevWalletInfo(): Promise<DcaWalletInfo> {
    return this.getWalletInfo(this.config.devPrivateKey!, true);
  }

  async getDevWalletAddress(): Promise<string | undefined> {
    if (!this.config.devPrivateKey) {
      return undefined;
    }
    return this.blockchainRepository.getAddressFromPrivateKey(this.config.devPrivateKey);
  }
}
