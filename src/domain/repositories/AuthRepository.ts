/**
 * Authorization repository interface
 */
import type { TelegramId } from "../models/id/index.js";
import { AuthorizedUser, UserRole } from "../models/AuthorizedUser.js";

export interface AuthRepository {
  /**
   * Get authorized user by Telegram ID
   */
  getById(telegramId: TelegramId): Promise<AuthorizedUser | undefined>;

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
  add(telegramId: TelegramId, role: UserRole, addedBy: TelegramId | null): Promise<void>;

  /**
   * Remove an authorized user
   */
  remove(telegramId: TelegramId): Promise<boolean>;

  /**
   * Update user's role
   */
  updateRole(telegramId: TelegramId, newRole: UserRole): Promise<boolean>;

  /**
   * Check if a user is authorized
   */
  isAuthorized(telegramId: TelegramId): Promise<boolean>;

  /**
   * Get user count
   */
  count(): Promise<number>;
}
