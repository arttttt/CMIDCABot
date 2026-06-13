/**
 * User repository interface
 */
import type { TelegramId, WalletAddress } from "../models/id/index.js";
import { User, UserWithWallet } from "../models/User.js";

export interface UserRepository {
  /**
   * Get user by Telegram ID
   */
  getById(telegramId: TelegramId): Promise<User | undefined>;

  /**
   * Create a new user (or ignore if exists)
   */
  create(telegramId: TelegramId): Promise<void>;

  /**
   * Update user's wallet address
   */
  setWalletAddress(telegramId: TelegramId, walletAddress: WalletAddress): Promise<void>;

  /**
   * Atomically set wallet private key and address.
   */
  setWalletData(
    telegramId: TelegramId,
    privateKey: string,
    walletAddress: WalletAddress,
  ): Promise<void>;

  /**
   * Get all users that have a wallet address set
   */
  getAllWithWallet(): Promise<UserWithWallet[]>;

  /**
   * Set user's DCA wallet private key
   */
  setPrivateKey(telegramId: TelegramId, privateKey: string): Promise<void>;

  /**
   * Get decrypted private key for signing operations.
   * Returns null if user has no private key.
   */
  getDecryptedPrivateKey(telegramId: TelegramId): Promise<string | null>;

  /**
   * Remove the user's wallet: clears both the private key and the address.
   * The user row itself is kept (auth, transaction history).
   */
  clearWallet(telegramId: TelegramId): Promise<void>;

  /**
   * Delete a user and all their data (wallet, settings)
   */
  delete(telegramId: TelegramId): Promise<void>;
}
