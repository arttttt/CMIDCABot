/**
 * DCA Wallet use cases - domain operations for DCA wallet management
 * Handles wallet creation, deletion, balance checking, and private key export
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { SolanaService } from "../../services/solana.js";
import { DcaWalletConfig } from "../../types/config.js";
import {
  ShowWalletResult,
  CreateWalletResult,
  DeleteWalletResult,
  ExportKeyResult,
  DcaWalletInfo,
} from "./types.js";

export class DcaWalletUseCases {
  constructor(
    private userRepository: UserRepository,
    private solana: SolanaService,
    private config: DcaWalletConfig,
  ) {}

  /**
   * Show current DCA wallet (without creating)
   */
  async showWallet(telegramId: number): Promise<ShowWalletResult> {
    await this.userRepository.create(telegramId);

    // Dev mode with override key
    if (this.config.devPrivateKey) {
      const wallet = await this.getDevWalletInfo();
      return { type: "dev_mode", wallet };
    }

    const user = await this.userRepository.getById(telegramId);

    if (!user?.privateKey) {
      return { type: "no_wallet" };
    }

    const wallet = await this.getWalletInfo(user.privateKey, false);
    return { type: "success", wallet };
  }

  /**
   * Create a new DCA wallet for user
   * Fails if wallet already exists
   */
  async createWallet(telegramId: number): Promise<CreateWalletResult> {
    await this.userRepository.create(telegramId);

    // Dev mode - cannot create wallets
    if (this.config.devPrivateKey) {
      const wallet = await this.getDevWalletInfo();
      return { type: "dev_mode", wallet };
    }

    const user = await this.userRepository.getById(telegramId);

    // Already has a wallet
    if (user?.privateKey) {
      const wallet = await this.getWalletInfo(user.privateKey, false);
      return { type: "already_exists", wallet };
    }

    // Generate new wallet
    const keypair = await this.solana.generateKeypair();
    await this.userRepository.setPrivateKey(telegramId, keypair.privateKeyBase64);

    const wallet = await this.getWalletInfo(keypair.privateKeyBase64, false);
    return { type: "created", wallet };
  }

  /**
   * Delete user's DCA wallet
   */
  async deleteWallet(telegramId: number): Promise<DeleteWalletResult> {
    // Dev mode - cannot delete dev wallet
    if (this.config.devPrivateKey) {
      return { type: "dev_mode" };
    }

    const user = await this.userRepository.getById(telegramId);

    if (!user?.privateKey) {
      return { type: "no_wallet" };
    }

    await this.userRepository.clearPrivateKey(telegramId);
    return { type: "deleted" };
  }

  /**
   * Export private key for user
   */
  async exportKey(telegramId: number): Promise<ExportKeyResult> {
    // Dev mode with override key
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
