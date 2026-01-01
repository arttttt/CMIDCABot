/**
 * Branded type for SPL token mint address
 *
 * Provides compile-time type safety for token mint addresses
 * with zero runtime overhead after validation.
 */

declare const __brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [__brand]: B };

/**
 * SPL token mint address - base58 encoded, 32-44 characters
 */
export type TokenMint = Brand<string, "TokenMint">;

/**
 * Regex pattern for valid SPL token mint address
 * Base58 alphabet: 1-9, A-H, J-N, P-Z, a-k, m-z (excludes 0, I, O, l)
 */
const TOKEN_MINT_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Create a validated TokenMint
 *
 * @param value - Raw string value
 * @returns Branded TokenMint
 * @throws Error if value is not a valid base58 mint address (32-44 chars)
 */
export function tokenMint(value: string): TokenMint {
  if (!TOKEN_MINT_PATTERN.test(value)) {
    throw new Error(`Invalid token mint: ${value}`);
  }
  return value as TokenMint;
}
