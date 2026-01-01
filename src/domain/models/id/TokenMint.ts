/**
 * Regex pattern for valid SPL token mint address
 * Base58 alphabet: 1-9, A-H, J-N, P-Z, a-k, m-z (excludes 0, I, O, l)
 */
const TOKEN_MINT_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * SPL token mint address - base58 encoded, 32-44 characters
 */
export class TokenMint {
  constructor(readonly value: string) {
    if (!TOKEN_MINT_PATTERN.test(value)) {
      throw new Error(`Invalid token mint: ${value}`);
    }
  }
}
