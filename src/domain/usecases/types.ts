/**
 * Domain use case result types
 * These are domain objects, NOT UI structures
 */

import type { WalletAddress } from "../models/id/index.js";
import { PortfolioStatus } from "../models/PortfolioTypes.js";

// Portfolio status result
export interface PortfolioStatusResult {
  type: "success" | "empty" | "not_found" | "error";
  status?: PortfolioStatus;
  error?: string;
}

// Init user result
export interface InitUserResult {
  type: "success";
}

// Wallet types
export interface WalletInfo {
  address: WalletAddress;
  balance: number | null;
  usdcBalance: number | null;
}

export interface GetWalletInfoResult {
  type: "success" | "no_wallet";
  wallet?: WalletInfo;
}

export interface CreateWalletResult {
  type: "created" | "already_exists" | "operation_in_progress";
  wallet?: WalletInfo;
  /** One-time URL to view seed phrase securely - only returned when type="created" */
  seedUrl?: string;
}

export interface DeleteWalletResult {
  type: "deleted" | "no_wallet";
}

export interface ExportKeyResult {
  type: "success" | "no_wallet";
  /** One-time URL to view private key securely */
  keyUrl?: string;
}

export interface ImportWalletResult {
  type: "imported" | "already_exists" | "invalid_key" | "operation_in_progress";
  wallet?: WalletInfo;
  error?: string;
}

/**
 * Result of an admin operation (add/remove/update user)
 */
export type AdminOperationResult =
  | { success: true; message: string }
  | { success: false; error: string };
