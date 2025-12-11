/**
 * Wallet use cases - domain operations for wallet management
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { SolanaService } from "../../services/solana.js";
import {
  WalletInfo,
  SetWalletResult,
  RemoveWalletResult,
  WalletCallbackResult,
} from "./types.js";

export class WalletUseCases {
  constructor(
    private userRepository: UserRepository,
    private solana: SolanaService,
  ) {}

  /**
   * Get wallet info with balance (best effort)
   */
  private async getWalletInfo(address: string): Promise<WalletInfo> {
    let balance: number | null = null;
    try {
      balance = await this.solana.getBalance(address);
    } catch {
      // Balance fetch failed - wallet may be new or network issue
    }
    return { address, balance };
  }

  /**
   * Show current wallet status
   */
  async showWallet(telegramId: number): Promise<SetWalletResult> {
    await this.userRepository.create(telegramId);
    const user = await this.userRepository.getById(telegramId);

    if (!user?.walletAddress) {
      return { type: "needs_confirmation" }; // No wallet - hint to set one
    }

    const wallet = await this.getWalletInfo(user.walletAddress);
    return { type: "success", wallet };
  }

  /**
   * Set a new wallet address
   */
  async setWallet(telegramId: number, address: string): Promise<SetWalletResult> {
    await this.userRepository.create(telegramId);

    // Validate address
    if (!this.solana.isValidAddress(address)) {
      return { type: "needs_confirmation" }; // Invalid - will be handled by formatter
    }

    const user = await this.userRepository.getById(telegramId);

    // No existing wallet - save directly
    if (!user?.walletAddress) {
      await this.userRepository.setWalletAddress(telegramId, address);
      const wallet = await this.getWalletInfo(address);
      return { type: "success", wallet };
    }

    // Same wallet
    if (user.walletAddress === address) {
      const wallet = await this.getWalletInfo(address);
      return { type: "already_connected", wallet };
    }

    // Different wallet - needs confirmation
    return {
      type: "needs_confirmation",
      existingAddress: user.walletAddress,
      newAddress: address,
    };
  }

  /**
   * Validate wallet address
   */
  isValidAddress(address: string): boolean {
    return this.solana.isValidAddress(address);
  }

  /**
   * Remove wallet
   */
  async removeWallet(telegramId: number): Promise<RemoveWalletResult> {
    const user = await this.userRepository.getById(telegramId);

    if (!user?.walletAddress) {
      return { type: "no_wallet" };
    }

    await this.userRepository.setWalletAddress(telegramId, "");
    return { type: "success" };
  }

  /**
   * Handle wallet replacement callback
   */
  async handleCallback(
    telegramId: number,
    callbackData: string,
  ): Promise<WalletCallbackResult> {
    if (callbackData === "wallet_cancel") {
      return { type: "cancelled" };
    }

    if (callbackData.startsWith("wallet_replace:")) {
      const address = callbackData.replace("wallet_replace:", "");

      if (!this.solana.isValidAddress(address)) {
        return { type: "invalid" };
      }

      await this.userRepository.setWalletAddress(telegramId, address);
      const wallet = await this.getWalletInfo(address);
      return { type: "replaced", wallet };
    }

    return { type: "unknown" };
  }
}
