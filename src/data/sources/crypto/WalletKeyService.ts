/**
 * WalletKeyService - Solana wallet key operations
 *
 * Pure key material handling: BIP39 mnemonic generation/derivation and
 * private key validation. No network access - RPC/transaction concerns
 * live in SolanaRpcClient.
 */

import {
  address,
  createKeyPairSignerFromPrivateKeyBytes,
  type KeyPairSigner,
} from "@solana/kit";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { WalletAddress } from "../../../domain/models/id/index.js";
import type {
  GeneratedKeypair,
  GeneratedKeypairWithMnemonic,
  ValidateMnemonicResult,
  ValidatePrivateKeyResult,
} from "../../../domain/repositories/BlockchainRepository.js";

/**
 * Solana BIP44 derivation path (compatible with Phantom, Solflare, etc.)
 * m/44'/501'/0'/0'
 * - 44' = BIP44 purpose
 * - 501' = Solana coin type
 * - 0' = account index
 * - 0' = change (external)
 */
const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

export class WalletKeyService {
  /**
   * Generate a new Solana keypair from BIP39 mnemonic.
   * Compatible with Phantom, Solflare, and other Solana wallets.
   *
   * Uses standard Solana derivation path: m/44'/501'/0'/0'
   *
   * @returns Generated keypair with mnemonic phrase
   */
  async generateKeypairFromMnemonic(): Promise<GeneratedKeypairWithMnemonic> {
    // Generate 12-word mnemonic (128 bits of entropy)
    const mnemonic = bip39.generateMnemonic();

    const keypair = await this.deriveKeypairFromMnemonic(mnemonic);

    return { ...keypair, mnemonic };
  }

  /**
   * Validate a BIP39 mnemonic phrase.
   *
   * Checks:
   * 1. Valid BIP39 mnemonic (12 or 24 words from wordlist)
   * 2. Can derive a valid Solana address
   *
   * @param mnemonic - Mnemonic phrase to validate
   * @returns Validation result with derived address if valid
   */
  async validateMnemonic(mnemonic: string): Promise<ValidateMnemonicResult> {
    try {
      // Normalize mnemonic
      const normalizedMnemonic = mnemonic.trim().toLowerCase().replace(/\s+/g, " ");

      // Check if valid BIP39 mnemonic
      if (!bip39.validateMnemonic(normalizedMnemonic)) {
        return { valid: false, error: "Invalid BIP39 mnemonic phrase" };
      }

      // Derive keypair to get address
      const keypair = await this.deriveKeypairFromMnemonic(normalizedMnemonic);

      // Verify the derived address is valid
      if (!this.isValidAddress(keypair.address.value)) {
        return { valid: false, error: "Derived address is not a valid Solana address" };
      }

      return {
        valid: true,
        address: keypair.address,
        normalizedKey: keypair.privateKeyBase64,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { valid: false, error: `Invalid mnemonic: ${message}` };
    }
  }

  /**
   * Validates that a string is a valid Solana Ed25519 private key
   *
   * Solana uses Ed25519 keys with 32-byte seeds.
   * This function checks:
   * 1. Valid base64 encoding
   * 2. Correct length (32 bytes for seed, or 64 bytes for full keypair)
   * 3. Can derive a valid Solana address
   *
   * Note: This naturally rejects Ethereum keys (secp256k1) because:
   * - ETH keys are typically hex-encoded, not base64
   * - Even if base64-encoded, Ed25519 derivation would fail
   */
  async validatePrivateKey(privateKeyBase64: string): Promise<ValidatePrivateKeyResult> {
    try {
      // Check valid base64
      const decoded = Buffer.from(privateKeyBase64, "base64");

      // Re-encode to verify it's proper base64 (not just any string)
      const reencoded = decoded.toString("base64");
      if (reencoded !== privateKeyBase64) {
        return { valid: false, error: "Invalid base64 encoding" };
      }

      // Check length: Solana Ed25519 seed is 32 bytes, full keypair is 64 bytes
      if (decoded.length !== 32 && decoded.length !== 64) {
        return {
          valid: false,
          error: `Invalid key length: ${decoded.length} bytes (expected 32 or 64)`,
        };
      }

      // Normalize: if 64 bytes, use only the first 32 (the seed)
      const seed = decoded.length === 64 ? decoded.slice(0, 32) : decoded;
      const normalizedKey = seed.toString("base64");

      // Try to derive address - this validates the key can create a valid Ed25519 keypair
      const derivedAddr = await this.getAddressFromPrivateKey(normalizedKey);

      // Verify the address is valid Solana format (base58, 32-44 chars)
      if (!this.isValidAddress(derivedAddr.value)) {
        return { valid: false, error: "Derived address is not a valid Solana address" };
      }

      return { valid: true, address: derivedAddr, normalizedKey };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { valid: false, error: `Invalid Solana private key: ${message}` };
    }
  }

  /**
   * Get address from a base64-encoded private key
   */
  async getAddressFromPrivateKey(privateKeyBase64: string): Promise<WalletAddress> {
    const signer = await this.createSignerFromPrivateKey(privateKeyBase64);
    return new WalletAddress(signer.address);
  }

  /**
   * Derive keypair from an existing BIP39 mnemonic.
   * Uses standard Solana derivation path: m/44'/501'/0'/0'
   *
   * @param mnemonic - BIP39 mnemonic phrase (12 or 24 words)
   * @returns Generated keypair (without mnemonic in result)
   */
  private async deriveKeypairFromMnemonic(mnemonic: string): Promise<GeneratedKeypair> {
    // Normalize mnemonic (lowercase, single spaces)
    const normalizedMnemonic = mnemonic.trim().toLowerCase().replace(/\s+/g, " ");

    // Convert mnemonic to seed
    const seed = bip39.mnemonicToSeedSync(normalizedMnemonic);

    // Derive Ed25519 key using Solana's standard path
    const derived = derivePath(SOLANA_DERIVATION_PATH, seed.toString("hex"));
    const privateKeyBytes = derived.key;

    // Create signer from derived key to get the address
    const signer = await createKeyPairSignerFromPrivateKeyBytes(
      privateKeyBytes,
      true,
    );

    return {
      address: new WalletAddress(signer.address),
      privateKeyBase64: Buffer.from(privateKeyBytes).toString("base64"),
    };
  }

  /**
   * Create a signer from a base64-encoded private key.
   * The input buffer is zeroed immediately after the signer is created
   * to minimize the time sensitive data remains in JS heap.
   */
  private async createSignerFromPrivateKey(privateKeyBase64: string): Promise<KeyPairSigner> {
    const privateKeyBytes = Buffer.from(privateKeyBase64, "base64");
    try {
      const signer = await createKeyPairSignerFromPrivateKeyBytes(privateKeyBytes, true);
      return signer;
    } finally {
      // Zero the buffer to minimize exposure window
      privateKeyBytes.fill(0);
    }
  }

  private isValidAddress(addr: string): boolean {
    try {
      address(addr);
      return true;
    } catch {
      return false;
    }
  }
}
