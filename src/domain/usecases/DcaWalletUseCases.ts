/**
 * DCA Wallet use cases - domain operations for DCA wallet management
 * Handles wallet generation, balance checking, and private key export
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { SolanaService } from "../../services/solana.js";
import { DcaWalletConfig } from "../../types/config.js";
import { DcaWalletResult, ExportKeyResult, DcaWalletInfo } from "./types.js";

export class DcaWalletUseCases {
  constructor(
    private userRepository: UserRepository,
    private solana: SolanaService,
    private config: DcaWalletConfig,
  ) {}

  /**
   * Get or generate DCA wallet for user
   * In dev mode with DEV_WALLET_PRIVATE_KEY set, uses that key for all users
   */
  async getOrCreateWallet(telegramId: number): Promise<DcaWalletResult> {
    await this.userRepository.create(telegramId);
    const user = await this.userRepository.getById(telegramId);

    // Dev mode with override key
    if (this.config.devPrivateKey) {
      const wallet = await this.getDevWalletInfo();
      return { type: "success", wallet };
    }

    // Check if user already has a wallet
    if (user?.privateKey) {
      const wallet = await this.getWalletInfo(user.privateKey, false);
      return { type: "success", wallet };
    }

    // Generate new wallet
    const keypair = await this.solana.generateKeypair();
    await this.userRepository.setPrivateKey(telegramId, keypair.privateKeyBase64);

    const wallet = await this.getWalletInfo(keypair.privateKeyBase64, false);
    return { type: "generated", wallet };
  }

  /**
   * Show current DCA wallet (without generating new one)
   */
  async showWallet(telegramId: number): Promise<DcaWalletResult> {
    const user = await this.userRepository.getById(telegramId);

    // Dev mode with override key
    if (this.config.devPrivateKey) {
      const wallet = await this.getDevWalletInfo();
      return { type: "success", wallet };
    }

    if (!user?.privateKey) {
      return { type: "no_wallet" };
    }

    const wallet = await this.getWalletInfo(user.privateKey, false);
    return { type: "success", wallet };
  }

  /**
   * Export private key for user
   */
  async exportKey(telegramId: number): Promise<ExportKeyResult> {
    // Dev mode with override key - show the dev key
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

  /**
   * Get wallet info from private key
   */
  private async getWalletInfo(privateKeyBase64: string, isDevWallet: boolean): Promise<DcaWalletInfo> {
    const address = await this.solana.getAddressFromPrivateKey(privateKeyBase64);

    let balance: number | null = null;
    try {
      balance = await this.solana.getBalance(address);
    } catch {
      // Balance fetch failed - wallet may be new or network issue
    }

    return { address, balance, isDevWallet };
  }

  /**
   * Get dev wallet info
   */
  private async getDevWalletInfo(): Promise<DcaWalletInfo> {
    return this.getWalletInfo(this.config.devPrivateKey!, true);
  }
}
