/**
 * Kysely database type definitions for authorization database
 */
import type { Generated } from "kysely";

/**
 * Authorization database tables
 */
export interface AuthDatabase {
  authorized_users: AuthorizedUsersTable;
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
