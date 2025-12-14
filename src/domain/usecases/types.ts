/**
 * Domain use case result types
 * These are domain objects, NOT UI structures
 */

import { AssetSymbol } from "../../types/portfolio.js";
import { PortfolioStatus } from "../../services/dca.js";

// Wallet info (used by balance)
export interface WalletInfo {
  address: string;
  balance: number | null; // null if fetch failed
}

// Balance result
export interface BalanceResult {
  type: "success" | "no_wallet" | "fetch_error";
  wallet?: WalletInfo;
}

// Purchase result (real swap via Jupiter)
export interface PurchaseResult {
  type: "success" | "invalid_amount" | "no_wallet" | "insufficient_balance" | "quote_error" | "build_error" | "send_error" | "unavailable";
  asset?: AssetSymbol;
  amountAsset?: number;
  amountUsdc?: number;
  priceUsd?: number;
  signature?: string;
  confirmed?: boolean;
  requiredBalance?: number;
  availableBalance?: number;
  error?: string;
}

// Portfolio status result
export interface PortfolioStatusResult {
  type: "success" | "empty" | "not_found" | "unavailable";
  status?: PortfolioStatus;
}

// Init user result
export interface InitUserResult {
  type: "success";
}

// DCA Wallet types
export interface DcaWalletInfo {
  address: string;
  balance: number | null;
  isDevWallet: boolean;
}

export interface ShowWalletResult {
  type: "success" | "no_wallet" | "dev_mode";
  wallet?: DcaWalletInfo;
}

export interface CreateWalletResult {
  type: "created" | "already_exists" | "dev_mode";
  wallet?: DcaWalletInfo;
}

export interface DeleteWalletResult {
  type: "deleted" | "no_wallet" | "dev_mode";
}

export interface ExportKeyResult {
  type: "success" | "no_wallet" | "dev_mode";
  privateKey?: string;
  isDevWallet?: boolean;
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
