/**
 * Create wallet use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { BlockchainRepository } from "../repositories/BlockchainRepository.js";
import { WalletInfoHelper } from "./helpers/WalletInfoHelper.js";
import { SecretStore } from "../../services/SecretStore.js";
import { CreateWalletResult } from "./types.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class CreateWalletUseCase {
  constructor(
    private userRepository: UserRepository,
    private blockchainRepository: BlockchainRepository,
    private walletHelper: WalletInfoHelper,
    private secretStore: SecretStore,
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

    if (user?.privateKey && user?.walletAddress) {
      logger.info("CreateWallet", "Wallet already exists", { telegramId });
      // Use walletAddress instead of decrypting privateKey
      const wallet = await this.walletHelper.getWalletInfoByAddress(user.walletAddress, false);
      return { type: "already_exists", wallet };
    }

    logger.debug("CreateWallet", "Generating new keypair with mnemonic");
    const keypair = await this.blockchainRepository.generateKeypairFromMnemonic();
    await this.userRepository.setPrivateKey(telegramId, keypair.privateKeyBase64);
    await this.userRepository.setWalletAddress(telegramId, keypair.address);

    logger.info("CreateWallet", "Wallet created", {
      telegramId,
      address: keypair.address,
    });

    const wallet = await this.walletHelper.getWalletInfo(keypair.privateKeyBase64, false);

    // Store seed phrase securely and return one-time URL
    const seedUrl = await this.secretStore.store(keypair.mnemonic, telegramId);
    return { type: "created", wallet, seedUrl };
  }
}
