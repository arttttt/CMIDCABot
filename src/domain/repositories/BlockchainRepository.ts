/**
 * Blockchain Repository Interface
 *
 * Port for blockchain operations (Dependency Inversion).
 * Abstracts Solana-specific details from domain layer.
 *
 * Implementations should handle:
 * - Wallet operations (address derivation, keypair generation, validation)
 * - Transaction operations (sign and send with encrypted key)
 *
 * Balance reads live in BalanceRepository.
 */

import type { TxSignature, WalletAddress } from "../models/id/index.js";

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
 * Port for blockchain operations.
 * Domain layer depends on this interface, not on concrete Solana implementation.
 */
export interface BlockchainRepository {
  // === Wallet Operations ===

  /**
   * Get address from a base64-encoded private key
   */
  getAddressFromPrivateKey(privateKeyBase64: string): Promise<WalletAddress>;

  /**
   * Generate a new keypair from BIP39 mnemonic (wallet-compatible)
   */
  generateKeypairFromMnemonic(): Promise<GeneratedKeypairWithMnemonic>;

  /**
   * Validate a BIP39 mnemonic phrase
   */
  validateMnemonic(mnemonic: string): Promise<ValidateMnemonicResult>;

  /**
   * Validate a private key
   */
  validatePrivateKey(privateKeyBase64: string): Promise<ValidatePrivateKeyResult>;

  // === Transaction Operations ===

  /**
   * Sign and send a transaction with encrypted private key (secure)
   */
  signAndSendTransactionSecure(
    transactionBase64: string,
    encryptedPrivateKey: string,
  ): Promise<SendTransactionResult>;
}
