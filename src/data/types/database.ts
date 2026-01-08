/**
 * Kysely database type definitions
 */
import type { Generated } from "kysely";

/**
 * Main database tables (production)
 */
export interface MainDatabase {
  users: UsersTable;
  transactions: TransactionsTable;
}

/**
 * Users table
 */
export interface UsersTable {
  telegram_id: number;
  wallet_address: string | null;
  private_key: string | null;
  is_dca_active: Generated<number>; // SQLite boolean: 0 = false, 1 = true
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

/**
 * Transactions table
 */
export interface TransactionsTable {
  id: Generated<number>;
  telegram_id: number;
  tx_signature: string;
  asset_symbol: string;
  amount_usdc: number;
  amount_asset: number;
  created_at: Generated<string>;
}
