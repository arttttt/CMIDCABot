/**
 * Gateway context
 *
 * Encapsulated state for request processing.
 * Created per-request inside Gateway.handle().
 */

import type { UserRole } from "../../../domain/models/AuthorizedUser.js";

export class GatewayContext {
  readonly requestId: string;
  readonly nowMs: number;
  private readonly state: Map<string, unknown>;

  constructor(requestId: string) {
    this.requestId = requestId;
    this.nowMs = Date.now();
    this.state = new Map();
  }

  /**
   * Set user role in context
   * Called by LoadRolePlugin after loading from repository
   */
  setRole(role: UserRole): void {
    this.state.set("userRole", role);
  }

  /**
   * Get user role from context
   * Returns "guest" if not set
   */
  getRole(): UserRole {
    return (this.state.get("userRole") as UserRole | undefined) ?? "guest";
  }
}
