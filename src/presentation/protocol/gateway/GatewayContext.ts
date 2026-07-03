/**
 * Gateway context
 *
 * Encapsulated state for request processing.
 * Created per-request inside Gateway.handle().
 */

import type { UserRole } from "../../../domain/models/AuthorizedUser.js";
import { RequestId } from "../../../domain/models/id/index.js";

export class GatewayContext {
  readonly requestId: RequestId;
  readonly nowMs: number;
  private userRole: UserRole = "guest";

  constructor(requestId: RequestId) {
    this.requestId = requestId;
    this.nowMs = Date.now();
  }

  /**
   * Set user role in context
   * Called by LoadRolePlugin after loading from repository
   */
  setRole(role: UserRole): void {
    this.userRole = role;
  }

  /**
   * Get user role from context
   * Returns "guest" if not set
   */
  getRole(): UserRole {
    return this.userRole;
  }
}
