/**
 * Create wallet use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { SolanaService } from "../../services/solana.js";
import { WalletInfoHelper } from "./helpers/WalletInfoHelper.js";
import { CreateWalletResult } from "./types.js";
import { logger } from "../../services/logger.js";

export class CreateWalletUseCase {
  constructor(
    private userRepository: UserRepository,
    private solana: SolanaService,
    private walletHelper: WalletInfoHelper,
  ) {}

  async execute(telegramId: number): Promise<CreateWalletResult> {
    logger.info("CreateWallet", "Creating wallet", { telegramId });

    await this.userRepository.create(telegramId);

    if (this.walletHelper.isDevMode()) {
      logger.debug("CreateWallet", "Dev mode - returning shared wallet");
      const wallet = await this.walletHelper.getDevWalletInfo();
      return { type: "dev_mode", wallet };
    }

    const user = await this.userRepository.getById(telegramId);

    if (user?.privateKey) {
      logger.info("CreateWallet", "Wallet already exists", { telegramId });
      const wallet = await this.walletHelper.getWalletInfo(user.privateKey, false);
      return { type: "already_exists", wallet };
    }

    logger.debug("CreateWallet", "Generating new keypair");
    const keypair = await this.solana.generateKeypair();
    await this.userRepository.setPrivateKey(telegramId, keypair.privateKeyBase64);
    await this.userRepository.setWalletAddress(telegramId, keypair.address);

    logger.info("CreateWallet", "Wallet created", {
      telegramId,
      address: keypair.address,
    });

    const wallet = await this.walletHelper.getWalletInfo(keypair.privateKeyBase64, false);
    return { type: "created", wallet };
  }
}
