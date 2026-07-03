/**
 * Invite token domain model for one-time authorization links
 */
import { UserRole } from "./AuthorizedUser.js";
import type { TelegramId } from "./id/index.js";

/**
 * Invite token - represents a one-time authorization link
 */
export interface InviteToken {
  /** SHA-256 hex of the token. The plaintext token lives only in the invite link. */
  tokenHash: string;
  /** Role to assign when activated */
  role: UserRole;
  /** Telegram ID of the user who created the invite */
  createdBy: TelegramId;
  /** When the token was created */
  createdAt: Date;
  /** When the token expires */
  expiresAt: Date;
  /** Telegram ID of user who used the invite (null if unused) */
  usedBy: TelegramId | null;
  /** When the token was used (null if unused) */
  usedAt: Date | null;
}

/**
 * Token expiration time in milliseconds (72 hours)
 */
export const INVITE_TOKEN_EXPIRY_MS = 72 * 60 * 60 * 1000;
