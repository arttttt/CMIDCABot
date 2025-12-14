/**
 * Import wallet use case
 * Allows users to import an existing Solana wallet via private key
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { SolanaService } from "../../services/solana.js";
import { WalletInfoHelper } from "./helpers/WalletInfoHelper.js";
import { ImportWalletResult } from "./types.js";
import { logger } from "../../services/logger.js";

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
async function validateSolanaPrivateKey(
  privateKeyBase64: string,
  solana: SolanaService,
): Promise<{ valid: boolean; address?: string; error?: string }> {
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

    // If 64 bytes, use only the first 32 (the seed)
    const seed = decoded.length === 64 ? decoded.slice(0, 32) : decoded;
    const seedBase64 = seed.toString("base64");

    // Try to derive address - this validates the key can create a valid Ed25519 keypair
    const address = await solana.getAddressFromPrivateKey(seedBase64);

    // Verify the address is valid Solana format (base58, 32-44 chars)
    if (!solana.isValidAddress(address)) {
      return { valid: false, error: "Derived address is not a valid Solana address" };
    }

    return { valid: true, address };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { valid: false, error: `Invalid Solana private key: ${message}` };
  }
}

export class ImportWalletUseCase {
  constructor(
    private userRepository: UserRepository,
    private solana: SolanaService,
    private walletHelper: WalletInfoHelper,
  ) {}

  async execute(telegramId: number, privateKeyBase64: string): Promise<ImportWalletResult> {
    logger.info("ImportWallet", "Importing wallet", { telegramId });

    // Ensure user exists
    await this.userRepository.create(telegramId);

    // Check dev mode
    if (this.walletHelper.isDevMode()) {
      logger.debug("ImportWallet", "Dev mode - cannot import wallets");
      const wallet = await this.walletHelper.getDevWalletInfo();
      return { type: "dev_mode", wallet };
    }

    // Check if wallet already exists
    const user = await this.userRepository.getById(telegramId);
    if (user?.privateKey) {
      logger.info("ImportWallet", "Wallet already exists", { telegramId });
      const wallet = await this.walletHelper.getWalletInfo(user.privateKey, false);
      return { type: "already_exists", wallet };
    }

    // Validate the private key
    const validation = await validateSolanaPrivateKey(privateKeyBase64, this.solana);
    if (!validation.valid) {
      logger.warn("ImportWallet", "Invalid private key", {
        telegramId,
        error: validation.error,
      });
      return { type: "invalid_key", error: validation.error };
    }

    // Normalize the key (use 32-byte seed if 64-byte keypair was provided)
    const decoded = Buffer.from(privateKeyBase64, "base64");
    const normalizedKey = decoded.length === 64
      ? decoded.slice(0, 32).toString("base64")
      : privateKeyBase64;

    // Store the wallet
    await this.userRepository.setPrivateKey(telegramId, normalizedKey);
    await this.userRepository.setWalletAddress(telegramId, validation.address!);

    logger.info("ImportWallet", "Wallet imported", {
      telegramId,
      address: validation.address,
    });

    const wallet = await this.walletHelper.getWalletInfo(normalizedKey, false);
    return { type: "imported", wallet };
  }
}
