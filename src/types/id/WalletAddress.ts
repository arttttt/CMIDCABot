/**
 * Branded type for Solana wallet address
 *
 * Provides compile-time type safety for wallet addresses
 * with zero runtime overhead after validation.
 */

declare const __brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [__brand]: B };

/**
 * Solana wallet address - base58 encoded public key, 32-44 characters
 */
export type WalletAddress = Brand<string, "WalletAddress">;

/**
 * Regex pattern for valid Solana wallet address
 * Base58 alphabet: 1-9, A-H, J-N, P-Z, a-k, m-z (excludes 0, I, O, l)
 */
const WALLET_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Create a validated WalletAddress
 *
 * @param value - Raw string value
 * @returns Branded WalletAddress
 * @throws Error if value is not a valid base58 address (32-44 chars)
 */
export function walletAddress(value: string): WalletAddress {
  if (!WALLET_ADDRESS_PATTERN.test(value)) {
    throw new Error(`Invalid wallet address: ${value}`);
  }
  return value as WalletAddress;
}
