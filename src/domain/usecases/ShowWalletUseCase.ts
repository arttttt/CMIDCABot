/**
 * Show wallet use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { WalletInfoHelper } from "./helpers/WalletInfoHelper.js";
import { ShowWalletResult } from "./types.js";

export class ShowWalletUseCase {
  constructor(
    private userRepository: UserRepository,
    private walletHelper: WalletInfoHelper,
  ) {}

  async execute(telegramId: number): Promise<ShowWalletResult> {
    await this.userRepository.create(telegramId);

    if (this.walletHelper.isDevMode()) {
      const wallet = await this.walletHelper.getDevWalletInfo();
      return { type: "dev_mode", wallet };
    }

    const user = await this.userRepository.getById(telegramId);

    if (!user?.privateKey) {
      return { type: "no_wallet" };
    }

    const wallet = await this.walletHelper.getWalletInfo(user.privateKey, false);
    return { type: "success", wallet };
  }
}
