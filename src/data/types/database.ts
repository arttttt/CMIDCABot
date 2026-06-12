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
  price_history: PriceHistoryTable;
}

/**
 * Users table
 */
export interface UsersTable {
  telegram_id: number;
  wallet_address: string | null;
  private_key: string | null;
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

/**
 * Price history table (market monitor)
 */
export interface PriceHistoryTable {
  id: Generated<number>;
  asset_symbol: string;
  price_usdc: number;
  timestamp_ms: number;
  source: string; // 'live' | 'backfill'
}
