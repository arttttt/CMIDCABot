/**
 * User repository interface
 */
import type { TelegramId, WalletAddress } from "../../types/id/index.js";
import { User, UserWithWallet, UserWithDcaWallet, ActiveDcaUser } from "../models/User.js";

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
   * Clear user's DCA wallet private key
   */
  clearPrivateKey(telegramId: TelegramId): Promise<void>;

  /**
   * Get all users that have a DCA wallet (private key) set
   */
  getAllWithDcaWallet(): Promise<UserWithDcaWallet[]>;

  /**
   * Set user's DCA active status
   */
  setDcaActive(telegramId: TelegramId, active: boolean): Promise<void>;

  /**
   * Get all active DCA users (have wallet AND DCA is enabled)
   */
  getAllActiveDcaUsers(): Promise<ActiveDcaUser[]>;

  /**
   * Check if there are any active DCA users
   */
  hasActiveDcaUsers(): Promise<boolean>;

  /**
   * Delete a user and all their data (wallet, DCA settings)
   */
  delete(telegramId: TelegramId): Promise<void>;
}
