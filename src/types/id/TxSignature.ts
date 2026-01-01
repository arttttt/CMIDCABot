/**
 * Branded type for Solana transaction signature
 *
 * Provides compile-time type safety for transaction signatures
 * with zero runtime overhead after validation.
 */

declare const __brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [__brand]: B };

/**
 * Solana transaction signature - base58 encoded, 87-88 characters
 */
export type TxSignature = Brand<string, "TxSignature">;

/**
 * Regex pattern for valid Solana transaction signature
 * Base58 alphabet: 1-9, A-H, J-N, P-Z, a-k, m-z (excludes 0, I, O, l)
 */
const TX_SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

/**
 * Create a validated TxSignature
 *
 * @param value - Raw string value
 * @returns Branded TxSignature
 * @throws Error if value is not a valid base58 signature (87-88 chars)
 */
export function txSignature(value: string): TxSignature {
  if (!TX_SIGNATURE_PATTERN.test(value)) {
    throw new Error(`Invalid transaction signature: ${value}`);
  }
  return value as TxSignature;
}
