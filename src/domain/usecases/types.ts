/**
 * Domain use case result types
 * These are domain objects, NOT UI structures
 */

import { AssetSymbol } from "../../types/portfolio.js";
import type { TxSignature, WalletAddress } from "../models/id/index.js";
import { PortfolioStatus } from "../models/PortfolioTypes.js";

// Wallet info (used by balance)
export interface WalletInfo {
  address: WalletAddress;
  balance: number | null; // null if fetch failed
}

// Balance result
export interface BalanceResult {
  type: "success" | "no_wallet" | "fetch_error";
  wallet?: WalletInfo;
}

// Purchase result (real swap via Jupiter)
export interface PurchaseResult {
  type: "success" | "invalid_amount" | "no_wallet" | "insufficient_usdc_balance" | "insufficient_sol_balance" | "rpc_error" | "quote_error" | "build_error" | "send_error" | "unavailable" | "high_price_impact";
  asset?: AssetSymbol;
  amountAsset?: number;
  amountUsdc?: number;
  priceUsd?: number;
  signature?: TxSignature;
  confirmed?: boolean;
  error?: string;
}

// Portfolio status result
export interface PortfolioStatusResult {
  type: "success" | "empty" | "not_found" | "unavailable" | "error";
  status?: PortfolioStatus;
  error?: string;
}

// Init user result
export interface InitUserResult {
  type: "success";
}

// DCA Wallet types
export interface DcaWalletInfo {
  address: WalletAddress;
  balance: number | null;
  usdcBalance: number | null;
  isDevWallet: boolean;
}

export interface GetWalletInfoResult {
  type: "success" | "no_wallet" | "dev_mode";
  wallet?: DcaWalletInfo;
}

export interface CreateWalletResult {
  type: "created" | "already_exists" | "dev_mode";
  wallet?: DcaWalletInfo;
  /** One-time URL to view seed phrase securely - only returned when type="created" */
  seedUrl?: string;
}

export interface DeleteWalletResult {
  type: "deleted" | "no_wallet" | "dev_mode";
}

export interface ExportKeyResult {
  type: "success" | "no_wallet" | "dev_mode";
  /** One-time URL to view private key securely */
  keyUrl?: string;
  isDevWallet?: boolean;
}

export interface ImportWalletResult {
  type: "imported" | "already_exists" | "invalid_key" | "dev_mode";
  wallet?: DcaWalletInfo;
  error?: string;
}

// DCA start/stop result types
export interface DcaStartResult {
  type: "started" | "already_active" | "no_wallet" | "unavailable";
  isSchedulerRunning?: boolean;
}

export interface DcaStopResult {
  type: "stopped" | "not_active" | "unavailable";
  isSchedulerRunning?: boolean;
}

export interface DcaStatusResult {
  type: "active" | "inactive" | "no_wallet" | "unavailable";
  isSchedulerRunning?: boolean;
}

/**
 * Result of an admin operation (add/remove/update user)
 */
export type AdminOperationResult =
  | { success: true; message: string }
  | { success: false; error: string };
