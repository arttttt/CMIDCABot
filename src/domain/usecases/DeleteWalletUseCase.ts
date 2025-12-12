/**
 * Delete wallet use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { WalletInfoHelper } from "./helpers/WalletInfoHelper.js";
import { DeleteWalletResult } from "./types.js";

export class DeleteWalletUseCase {
  constructor(
    private userRepository: UserRepository,
    private walletHelper: WalletInfoHelper,
  ) {}

  async execute(telegramId: number): Promise<DeleteWalletResult> {
    if (this.walletHelper.isDevMode()) {
      return { type: "dev_mode" };
    }

    const user = await this.userRepository.getById(telegramId);

    if (!user?.privateKey) {
      return { type: "no_wallet" };
    }

    await this.userRepository.clearPrivateKey(telegramId);
    return { type: "deleted" };
  }
}
