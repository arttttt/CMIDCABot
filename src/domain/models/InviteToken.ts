/**
 * Invite token domain model for one-time authorization links
 */
import { UserRole } from "./AuthorizedUser.js";

/**
 * Invite token - represents a one-time authorization link
 */
export interface InviteToken {
  /** Unique token string (base64url, 16+ characters) */
  token: string;
  /** Role to assign when activated */
  role: UserRole;
  /** Telegram ID of the user who created the invite */
  createdBy: number;
  /** When the token was created */
  createdAt: Date;
  /** When the token expires */
  expiresAt: Date;
  /** Telegram ID of user who used the invite (null if unused) */
  usedBy: number | null;
  /** When the token was used (null if unused) */
  usedAt: Date | null;
}

/**
 * Token expiration time in milliseconds (72 hours)
 */
export const INVITE_TOKEN_EXPIRY_MS = 72 * 60 * 60 * 1000;

/**
 * Check if token is expired
 */
export function isTokenExpired(token: InviteToken): boolean {
  return new Date() > token.expiresAt;
}

/**
 * Check if token has been used
 */
export function isTokenUsed(token: InviteToken): boolean {
  return token.usedBy !== null;
}

/**
 * Check if token is valid (not expired and not used)
 */
export function isTokenValid(token: InviteToken): boolean {
  return !isTokenExpired(token) && !isTokenUsed(token);
}
