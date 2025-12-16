/**
 * Authorization repository interface
 */
import { AuthorizedUser, UserRole } from "../models/AuthorizedUser.js";

export interface AuthRepository {
  /**
   * Get authorized user by Telegram ID
   */
  getById(telegramId: number): Promise<AuthorizedUser | undefined>;

  /**
   * Get all authorized users
   */
  getAll(): Promise<AuthorizedUser[]>;

  /**
   * Get all users with a specific role
   */
  getByRole(role: UserRole): Promise<AuthorizedUser[]>;

  /**
   * Add a new authorized user
   */
  add(telegramId: number, role: UserRole, addedBy: number | null): Promise<void>;

  /**
   * Remove an authorized user
   */
  remove(telegramId: number): Promise<boolean>;

  /**
   * Update user's role
   */
  updateRole(telegramId: number, newRole: UserRole): Promise<boolean>;

  /**
   * Check if a user is authorized
   */
  isAuthorized(telegramId: number): Promise<boolean>;

  /**
   * Get user count
   */
  count(): Promise<number>;
}
