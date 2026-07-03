/**
 * RoleGuard - access control utility for handlers
 *
 * Provides a single point for role-based access checks.
 * Encapsulates role hierarchy logic.
 */

import type { UserRole } from "../../../domain/models/AuthorizedUser.js";
import { AuthorizationPolicy } from "../../../domain/policies/AuthorizationPolicy.js";

export class RoleGuard {
  /**
   * Check if user has access to resource with required role.
   *
   * @param role - User's current role
   * @param requiredRole - Required role for the resource (undefined = no restriction)
   * @returns true if access is granted, false if denied
   */
  static canAccess(role: UserRole, requiredRole: UserRole | undefined): boolean {
    if (!requiredRole) return true;
    return AuthorizationPolicy.hasRequiredRole(role, requiredRole);
  }
}
