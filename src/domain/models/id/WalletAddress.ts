/**
 * Regex pattern for valid Solana wallet address
 * Base58 alphabet: 1-9, A-H, J-N, P-Z, a-k, m-z (excludes 0, I, O, l)
 */
const WALLET_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Solana wallet address - base58 encoded public key, 32-44 characters
 */
export class WalletAddress {
  constructor(readonly value: string) {
    if (!WALLET_ADDRESS_PATTERN.test(value)) {
      throw new Error(`Invalid wallet address: ${value}`);
    }
  }
}
