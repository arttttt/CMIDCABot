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
 * Mock database tables (development only)
 */
export interface MockDatabase {
  portfolio: PortfolioTable;
  purchases: PurchasesTable;
  scheduler_state: SchedulerStateTable;
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
 * Portfolio table (mock/development)
 */
export interface PortfolioTable {
  telegram_id: number;
  btc_balance: Generated<number>;
  eth_balance: Generated<number>;
  sol_balance: Generated<number>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

/**
 * Purchases table
 */
export interface PurchasesTable {
  id: Generated<number>;
  telegram_id: number;
  asset_symbol: string;
  amount_usdc: number;
  amount_asset: number;
  price_usd: number;
  created_at: Generated<string>;
}

/**
 * Scheduler state table
 */
export interface SchedulerStateTable {
  id: number;
  last_run_at: string | null;
  interval_ms: number;
  updated_at: Generated<string>;
}
