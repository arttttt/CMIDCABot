/**
 * Export wallet key use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { DcaWalletConfig } from "../../types/config.js";
import { ExportKeyResult } from "./types.js";

export class ExportWalletKeyUseCase {
  constructor(
    private userRepository: UserRepository,
    private config: DcaWalletConfig,
  ) {}

  async execute(telegramId: number): Promise<ExportKeyResult> {
    if (this.config.devPrivateKey) {
      return {
        type: "dev_mode",
        privateKey: this.config.devPrivateKey,
        isDevWallet: true,
      };
    }

    const user = await this.userRepository.getById(telegramId);

    if (!user?.privateKey) {
      return { type: "no_wallet" };
    }

    return {
      type: "success",
      privateKey: user.privateKey,
      isDevWallet: false,
    };
  }
}
