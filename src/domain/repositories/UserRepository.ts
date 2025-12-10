/**
 * User repository interface
 */
import { User, UserWithWallet } from "../models/User.js";

export interface UserRepository {
  /**
   * Get user by Telegram ID
   */
  getById(telegramId: number): User | undefined;

  /**
   * Create a new user (or ignore if exists)
   */
  create(telegramId: number): void;

  /**
   * Update user's wallet address
   */
  setWalletAddress(telegramId: number, walletAddress: string): void;

  /**
   * Get all users that have a wallet address set
   */
  getAllWithWallet(): UserWithWallet[];
}
