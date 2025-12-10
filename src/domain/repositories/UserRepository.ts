/**
 * User repository interface
 */
import { User, UserWithWallet } from "../models/User.js";

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
}
