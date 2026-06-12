/**
 * Invite token repository interface
 */
import type { TelegramId } from "../models/id/index.js";
import type { InviteToken } from "../models/InviteToken.js";
import type { UserRole } from "../models/AuthorizedUser.js";

export interface InviteTokenRepository {
  /**
   * Create a new invite token.
   *
   * `token` is the plaintext value; implementations must persist only
   * its hash - a leaked storage must not expose usable invites.
   */
  create(token: string, role: UserRole, createdBy: TelegramId, expiresAt: Date): Promise<void>;

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
