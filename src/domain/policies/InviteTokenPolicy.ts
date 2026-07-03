/**
 * Invite token policy - pure validity rules for one-time invite tokens
 */
import type { InviteToken } from "../models/InviteToken.js";

export class InviteTokenPolicy {
  /**
   * Check if token is expired
   */
  static isExpired(token: InviteToken): boolean {
    return new Date() > token.expiresAt;
  }

  /**
   * Check if token has been used
   */
  static isUsed(token: InviteToken): boolean {
    return token.usedBy !== null;
  }
}
