/**
 * Get wallet info by private key use case
 */

import { BlockchainRepository } from "../repositories/BlockchainRepository.js";
import type { DcaWalletInfo } from "./types.js";
import { GetWalletBalancesUseCase } from "./GetWalletBalancesUseCase.js";

export class GetWalletInfoByPrivateKeyUseCase {
  constructor(
    private blockchainRepository: BlockchainRepository,
    private getWalletBalancesUseCase: GetWalletBalancesUseCase,
  ) {}

  /**
   * Get wallet info from plaintext private key.
   * Used for newly created/imported wallets before encryption.
   */
  async execute(privateKeyBase64: string, isDevWallet: boolean): Promise<DcaWalletInfo> {
    const address = await this.blockchainRepository.getAddressFromPrivateKey(privateKeyBase64);
    const { balance, usdcBalance } = await this.getWalletBalancesUseCase.execute(address);

    return { address, balance, usdcBalance, isDevWallet };
  }
}
