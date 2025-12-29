/**
 * RoleGuard - access control utility for handlers
 *
 * Provides a single point for role-based access checks.
 * Encapsulates role hierarchy logic.
 */

import type { UserRole } from "../../../domain/models/AuthorizedUser.js";

export class RoleGuard {
  /** Role hierarchy levels (higher = more privileges) */
  private static readonly ROLE_LEVELS: Record<UserRole, number> = {
    owner: 3,
    admin: 2,
    user: 1,
    guest: 0,
  };

  /**
   * Check if user has access to resource with required role.
   *
   * @param role - User's current role
   * @param requiredRole - Required role for the resource (undefined = no restriction)
   * @returns true if access is granted, false if denied
   */
  static canAccess(role: UserRole, requiredRole: UserRole | undefined): boolean {
    if (!requiredRole) return true;
    return this.ROLE_LEVELS[role] >= this.ROLE_LEVELS[requiredRole];
  }
}
