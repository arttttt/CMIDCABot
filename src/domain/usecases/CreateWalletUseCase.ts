/**
 * Create wallet use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { SolanaService } from "../../services/solana.js";
import { WalletInfoHelper } from "./helpers/WalletInfoHelper.js";
import { CreateWalletResult } from "./types.js";

export class CreateWalletUseCase {
  constructor(
    private userRepository: UserRepository,
    private solana: SolanaService,
    private walletHelper: WalletInfoHelper,
  ) {}

  async execute(telegramId: number): Promise<CreateWalletResult> {
    await this.userRepository.create(telegramId);

    if (this.walletHelper.isDevMode()) {
      const wallet = await this.walletHelper.getDevWalletInfo();
      return { type: "dev_mode", wallet };
    }

    const user = await this.userRepository.getById(telegramId);

    if (user?.privateKey) {
      const wallet = await this.walletHelper.getWalletInfo(user.privateKey, false);
      return { type: "already_exists", wallet };
    }

    const keypair = await this.solana.generateKeypair();
    await this.userRepository.setPrivateKey(telegramId, keypair.privateKeyBase64);

    const wallet = await this.walletHelper.getWalletInfo(keypair.privateKeyBase64, false);
    return { type: "created", wallet };
  }
}
