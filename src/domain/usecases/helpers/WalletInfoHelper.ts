/**
 * Helper for getting wallet info
 */

import { SolanaService } from "../../../services/solana.js";
import { DcaWalletConfig } from "../../../types/config.js";
import { DcaWalletInfo } from "../types.js";

export class WalletInfoHelper {
  constructor(
    private solana: SolanaService,
    private config: DcaWalletConfig,
  ) {}

  isDevMode(): boolean {
    return !!this.config.devPrivateKey;
  }

  async getWalletInfo(privateKeyBase64: string, isDevWallet: boolean): Promise<DcaWalletInfo> {
    const address = await this.solana.getAddressFromPrivateKey(privateKeyBase64);

    let balance: number | null = null;
    try {
      balance = await this.solana.getBalance(address);
    } catch {
      // Balance fetch failed - wallet may be new or network issue
    }

    return { address, balance, isDevWallet };
  }

  async getDevWalletInfo(): Promise<DcaWalletInfo> {
    return this.getWalletInfo(this.config.devPrivateKey!, true);
  }
}
