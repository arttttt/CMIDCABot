/**
 * Invite token repository interface
 */
import type { TelegramId } from "../models/id/index.js";
import type { InviteToken } from "../models/InviteToken.js";
import type { UserRole } from "../models/AuthorizedUser.js";

export interface InviteTokenRepository {
  /**
   * Create a new invite token
   */
  create(token: string, role: UserRole, createdBy: TelegramId, expiresAt: Date): Promise<void>;

  /**
   * Get token by its string value
   */
  getByToken(token: string): Promise<InviteToken | undefined>;

  /**
   * Mark token as used
   */
  markUsed(token: string, usedBy: TelegramId): Promise<boolean>;

  /**
   * Get all tokens created by a specific user
   */
  getByCreator(createdBy: TelegramId): Promise<InviteToken[]>;
}
