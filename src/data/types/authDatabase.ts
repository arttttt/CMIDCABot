/**
 * Kysely database type definitions for authorization database
 */
import type { Generated } from "kysely";

/**
 * Authorization database tables
 */
export interface AuthDatabase {
  authorized_users: AuthorizedUsersTable;
  invite_tokens: InviteTokensTable;
}

/**
 * Authorized users table
 */
export interface AuthorizedUsersTable {
  telegram_id: number;
  role: string; // 'owner' | 'admin' | 'user'
  added_by: number | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

/**
 * Invite tokens table
 */
export interface InviteTokensTable {
  token: string;
  role: string; // 'admin' | 'user'
  created_by: number;
  created_at: Generated<string>;
  expires_at: string;
  used_by: number | null;
  used_at: string | null;
}
