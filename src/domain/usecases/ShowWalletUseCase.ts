/**
 * Show wallet use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { WalletInfoHelper } from "./helpers/WalletInfoHelper.js";
import { ShowWalletResult } from "./types.js";
import { logger } from "../../services/logger.js";

export class ShowWalletUseCase {
  constructor(
    private userRepository: UserRepository,
    private walletHelper: WalletInfoHelper,
  ) {}

  async execute(telegramId: number): Promise<ShowWalletResult> {
    logger.info("ShowWallet", "Showing wallet", { telegramId });

    await this.userRepository.create(telegramId);

    if (this.walletHelper.isDevMode()) {
      logger.debug("ShowWallet", "Using dev mode wallet");
      const wallet = await this.walletHelper.getDevWalletInfo();
      logger.info("ShowWallet", "Dev wallet info retrieved", {
        address: wallet.address,
        balance: wallet.balance,
      });
      return { type: "dev_mode", wallet };
    }

    const user = await this.userRepository.getById(telegramId);

    // Check if user has a wallet (privateKey is stored encrypted, walletAddress is plaintext)
    if (!user?.privateKey || !user?.walletAddress) {
      logger.warn("ShowWallet", "No wallet found", { telegramId });
      return { type: "no_wallet" };
    }

    // Use stored walletAddress instead of decrypting the key
    logger.debug("ShowWallet", "Fetching wallet info by address");
    const wallet = await this.walletHelper.getWalletInfoByAddress(user.walletAddress, false);
    logger.info("ShowWallet", "Wallet info retrieved", {
      address: wallet.address,
      balance: wallet.balance,
    });
    return { type: "success", wallet };
  }
}
