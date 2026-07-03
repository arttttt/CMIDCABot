/**
 * User authorization domain model
 */
import type { TelegramId } from "./id/index.js";

/**
 * User roles in the system
 * - owner: Super admin, cannot be modified or removed
 * - admin: Can manage users (add/remove users, but not admins)
 * - user: Regular authorized user
 * - guest: Unauthorized user (can only use /start)
 */
export type UserRole = "owner" | "admin" | "user" | "guest";

/**
 * Authorized user - represents a user who has access to the bot
 */
export interface AuthorizedUser {
  telegramId: TelegramId;
  role: UserRole;
  addedBy: TelegramId | null; // telegram_id of admin who added this user, null for owner
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Role hierarchy for display purposes
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  user: "User",
  guest: "Guest",
};
