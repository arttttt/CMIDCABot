/**
 * User repository interface
 */
import { User, UserWithWallet, UserWithDcaWallet, ActiveDcaUser } from "../models/User.js";

export interface UserRepository {
  /**
   * Get user by Telegram ID
   */
  getById(telegramId: number): Promise<User | undefined>;

  /**
   * Create a new user (or ignore if exists)
   */
  create(telegramId: number): Promise<void>;

  /**
   * Update user's wallet address
   */
  setWalletAddress(telegramId: number, walletAddress: string): Promise<void>;

  /**
   * Get all users that have a wallet address set
   */
  getAllWithWallet(): Promise<UserWithWallet[]>;

  /**
   * Set user's DCA wallet private key
   */
  setPrivateKey(telegramId: number, privateKey: string): Promise<void>;

  /**
   * Clear user's DCA wallet private key
   */
  clearPrivateKey(telegramId: number): Promise<void>;

  /**
   * Get all users that have a DCA wallet (private key) set
   */
  getAllWithDcaWallet(): Promise<UserWithDcaWallet[]>;

  /**
   * Set user's DCA active status
   */
  setDcaActive(telegramId: number, active: boolean): Promise<void>;

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
  delete(telegramId: number): Promise<void>;
}
