/**
 * RoleGuard - access control utility for handlers
 *
 * Provides a single point for role-based access checks.
 * Removes duplication between message and callback handlers.
 */

import type { GatewayContext } from "./GatewayContext.js";
import type { UserRole } from "../../../domain/models/AuthorizedUser.js";
import { hasRequiredRole } from "../../../domain/models/AuthorizedUser.js";

export class RoleGuard {
  /**
   * Check if user has access to resource with required role.
   *
   * @param ctx - Gateway context with user role
   * @param requiredRole - Required role for the resource (undefined = no restriction)
   * @returns true if access is granted, false if denied
   */
  static canAccess(ctx: GatewayContext, requiredRole: UserRole | undefined): boolean {
    return !requiredRole || hasRequiredRole(ctx.getRole(), requiredRole);
  }
}
