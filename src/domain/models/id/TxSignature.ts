/**
 * Regex pattern for valid Solana transaction signature
 * Base58 alphabet: 1-9, A-H, J-N, P-Z, a-k, m-z (excludes 0, I, O, l)
 */
const TX_SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

/**
 * Solana transaction signature - base58 encoded, 87-88 characters
 */
export class TxSignature {
  constructor(readonly value: string) {
    if (!TX_SIGNATURE_PATTERN.test(value)) {
      throw new Error(`Invalid transaction signature: ${value}`);
    }
  }
}
