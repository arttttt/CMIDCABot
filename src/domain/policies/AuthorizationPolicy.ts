/**
 * Authorization policy - pure role-hierarchy rules
 *
 * Single source of truth for who can manage whom and
 * how roles compare in the hierarchy.
 */
import type { UserRole } from "../models/AuthorizedUser.js";

export class AuthorizationPolicy {
  /** Role hierarchy levels (higher = more privileges) */
  private static readonly ROLE_LEVELS: Record<UserRole, number> = {
    owner: 3,
    admin: 2,
    user: 1,
    guest: 0,
  };

  /**
   * Check if a role can manage another role
   * - owner can manage admin and user
   * - admin can manage user only
   * - user cannot manage anyone
   */
  static canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
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
  static isAdminRole(role: UserRole): boolean {
    return role === "owner" || role === "admin";
  }

  /**
   * Check if user's role meets the required role level.
   * Hierarchy: owner > admin > user > guest.
   */
  static hasRequiredRole(userRole: UserRole, requiredRole: UserRole): boolean {
    return this.ROLE_LEVELS[userRole] >= this.ROLE_LEVELS[requiredRole];
  }

  /**
   * Shared precondition for admin operations.
   *
   * @returns error message, or null when the caller may proceed
   */
  static checkAdminAccess(adminRole: UserRole): string | null {
    if (adminRole === "guest") {
      return "Not authorized";
    }
    if (!this.isAdminRole(adminRole)) {
      return "Admin privileges required";
    }
    return null;
  }
}
