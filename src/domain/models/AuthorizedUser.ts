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
 * Check if a role can manage another role
 * - owner can manage admin and user
 * - admin can manage user only
 * - user cannot manage anyone
 */
export function canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
  if (managerRole === "owner") {
    return targetRole !== "owner";
  }
  if (managerRole === "admin") {
    return targetRole === "user";
  }
  return false;
}

/**
 * Check if a role has admin privileges (can manage users)
 */
export function isAdminRole(role: UserRole): boolean {
  return role === "owner" || role === "admin";
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

/**
 * Role hierarchy levels (higher = more privileges)
 */
const ROLE_LEVELS: Record<UserRole, number> = {
  owner: 3,
  admin: 2,
  user: 1,
  guest: 0,
};

/**
 * Check if user's role meets the required role level
 * Returns true if userRole >= requiredRole in hierarchy
 *
 * Hierarchy: owner > admin > user
 *
 * @example
 * hasRequiredRole("owner", "admin") // true - owner can access admin features
 * hasRequiredRole("admin", "admin") // true - admin can access admin features
 * hasRequiredRole("user", "admin")  // false - user cannot access admin features
 */
export function hasRequiredRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
}
