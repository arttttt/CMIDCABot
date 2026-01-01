/**
 * Blockchain Repository Interface
 *
 * Port for blockchain operations (Dependency Inversion).
 * Abstracts Solana-specific details from domain layer.
 *
 * Implementations should handle:
 * - Wallet operations (balance, address derivation, keypair generation)
 * - Transaction operations (sign and send)
 * - Token operations (token balances)
 */

import type { TokenMint, TxSignature, WalletAddress } from "../models/id/index.js";

/**
 * Generated keypair with extractable private key
 */
export interface GeneratedKeypair {
  address: WalletAddress;
  privateKeyBase64: string;
}

/**
 * Generated keypair with BIP39 mnemonic (wallet-compatible)
 */
export interface GeneratedKeypairWithMnemonic extends GeneratedKeypair {
  mnemonic: string;
}

/**
 * Result of mnemonic validation
 */
export interface ValidateMnemonicResult {
  valid: boolean;
  address?: WalletAddress;
  normalizedKey?: string;
  error?: string;
}

/**
 * Result of private key validation
 */
export interface ValidatePrivateKeyResult {
  valid: boolean;
  address?: WalletAddress;
  normalizedKey?: string;
  error?: string;
}

/**
 * Result of sending a transaction
 */
export interface SendTransactionResult {
  success: boolean;
  signature: TxSignature | null;
  error: string | null;
  confirmed: boolean;
}

/**
 * Result of transaction simulation
 */
export interface SimulationResult {
  success: boolean;
  error: string | null;
  unitsConsumed: number | null;
  logs: string[];
}

/**
 * Token configuration for batch balance fetching
 */
export interface TokenConfig {
  mint: TokenMint;
  decimals: number;
}

/**
 * Result of batch balance fetch
 */
export interface BatchBalancesResult {
  sol: number;
  btc: number;
  eth: number;
  usdc: number;
}

/**
 * Port for blockchain operations.
 * Domain layer depends on this interface, not on concrete Solana implementation.
 */
export interface BlockchainRepository {
  // === Wallet Operations ===

  /**
   * Get native token balance (e.g., SOL balance in lamports converted to decimal)
   */
  getBalance(walletAddress: WalletAddress): Promise<number>;

  /**
   * Get address from a base64-encoded private key
   */
  getAddressFromPrivateKey(privateKeyBase64: string): Promise<WalletAddress>;

  /**
   * Generate a new keypair
   */
  generateKeypair(): Promise<GeneratedKeypair>;

  /**
   * Generate a new keypair from BIP39 mnemonic (wallet-compatible)
   */
  generateKeypairFromMnemonic(): Promise<GeneratedKeypairWithMnemonic>;

  /**
   * Derive keypair from an existing BIP39 mnemonic
   */
  deriveKeypairFromMnemonic(mnemonic: string): Promise<GeneratedKeypair>;

  /**
   * Validate a BIP39 mnemonic phrase
   */
  validateMnemonic(mnemonic: string): Promise<ValidateMnemonicResult>;

  /**
   * Validate a private key
   */
  validatePrivateKey(privateKeyBase64: string): Promise<ValidatePrivateKeyResult>;

  /**
   * Check if address is valid (raw string, not yet branded)
   */
  isValidAddress(walletAddress: string): walletAddress is WalletAddress;

  // === Transaction Operations ===

  /**
   * Sign and send a transaction (with plaintext private key)
   */
  signAndSendTransaction(
    transactionBase64: string,
    privateKeyBase64: string,
  ): Promise<SendTransactionResult>;

  /**
   * Sign and send a transaction with encrypted private key (secure)
   */
  signAndSendTransactionSecure(
    transactionBase64: string,
    encryptedPrivateKey: string,
  ): Promise<SendTransactionResult>;

  /**
   * Simulate a transaction without sending
   */
  simulateTransaction(transactionBase64: string): Promise<SimulationResult>;

  // === Token Operations ===

  /**
   * Get SPL token balance for a wallet
   */
  getTokenBalance(
    walletAddress: WalletAddress,
    tokenMint: TokenMint,
    decimals?: number,
  ): Promise<number>;

  /**
   * Get USDC balance for a wallet
   */
  getUsdcBalance(walletAddress: WalletAddress): Promise<number>;

  /**
   * Get all portfolio balances in a single batch request
   */
  getAllBalancesBatch(
    walletAddress: WalletAddress,
    tokens: {
      btc: TokenConfig;
      eth: TokenConfig;
      usdc: TokenConfig;
    },
  ): Promise<BatchBalancesResult>;
}
