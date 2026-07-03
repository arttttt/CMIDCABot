/**
 * Invite token repository interface
 */
import type { TelegramId } from "../models/id/index.js";
import type { InviteToken } from "../models/InviteToken.js";
import type { UserRole } from "../models/AuthorizedUser.js";

export interface InviteTokenRepository {
  /**
   * Create a new invite token and return its plaintext value.
   *
   * Implementations generate the token (cryptographically secure) and
   * persist only its hash - a leaked storage must not expose usable
   * invites. The plaintext exists solely in the returned invite link.
   */
  create(role: UserRole, createdBy: TelegramId, expiresAt: Date): Promise<string>;

  /**
   * Get token by its plaintext value
   */
  getByToken(token: string): Promise<InviteToken | undefined>;

  /**
   * Mark token as used (looked up by plaintext value)
   */
  markUsed(token: string, usedBy: TelegramId): Promise<boolean>;

  /**
   * Get all tokens created by a specific user
   */
  getByCreator(createdBy: TelegramId): Promise<InviteToken[]>;
}
