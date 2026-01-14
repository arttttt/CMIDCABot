/**
 * Get wallet info by address use case
 */

import type { WalletAddress } from "../models/id/index.js";
import type { DcaWalletInfo } from "./types.js";
import { GetWalletBalancesUseCase } from "./GetWalletBalancesUseCase.js";

export class GetWalletInfoByAddressUseCase {
  constructor(
    private getWalletBalancesUseCase: GetWalletBalancesUseCase,
  ) {}

  /**
   * Get wallet info from address only.
   * Used for existing wallets where we don't want to decrypt the key.
   */
  async execute(address: WalletAddress, isDevWallet: boolean): Promise<DcaWalletInfo> {
    const { balance, usdcBalance } = await this.getWalletBalancesUseCase.execute(address);

    return { address, balance, usdcBalance, isDevWallet };
  }
}
