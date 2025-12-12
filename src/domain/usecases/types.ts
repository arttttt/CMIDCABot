/**
 * Domain use case result types
 * These are domain objects, NOT UI structures
 */

import { AssetSymbol } from "../../types/portfolio.js";
import { PortfolioStatus } from "../../services/dca.js";

// Wallet operation results
export interface WalletInfo {
  address: string;
  balance: number | null; // null if fetch failed
}

export interface SetWalletResult {
  type: "success" | "already_connected" | "needs_confirmation";
  wallet?: WalletInfo;
  existingAddress?: string;
  newAddress?: string;
}

export interface RemoveWalletResult {
  type: "success" | "no_wallet";
}

export interface WalletCallbackResult {
  type: "replaced" | "cancelled" | "invalid" | "unknown";
  wallet?: WalletInfo;
}

// Balance result
export interface BalanceResult {
  type: "success" | "no_wallet" | "fetch_error";
  wallet?: WalletInfo;
}

// Purchase result
export interface PurchaseResult {
  type: "success" | "invalid_amount" | "no_wallet" | "insufficient_balance" | "failed" | "unavailable";
  asset?: AssetSymbol;
  amountAsset?: number;
  amountSol?: number;
  priceUsd?: number;
  valueUsd?: number;
  requiredBalance?: number;
  availableBalance?: number;
  error?: string;
}

// Portfolio status result
export interface PortfolioStatusResult {
  type: "success" | "empty" | "not_found" | "unavailable";
  status?: PortfolioStatus;
}

// Reset result
export interface ResetResult {
  type: "success" | "unavailable";
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

export interface DcaWalletResult {
  type: "success" | "generated" | "no_wallet";
  wallet?: DcaWalletInfo;
}

export interface ExportKeyResult {
  type: "success" | "no_wallet" | "dev_mode";
  privateKey?: string;
  isDevWallet?: boolean;
}
