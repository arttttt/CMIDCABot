import {
  createSolanaRpc,
  address,
  type Rpc,
  type SolanaRpcApi,
  createKeyPairSignerFromPrivateKeyBytes,
  type KeyPairSigner,
  type Signature,
  type Base64EncodedWireTransaction,
  getTransactionDecoder,
  getTransactionEncoder,
  signTransaction,
} from "@solana/kit";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { SolanaConfig } from "../../../types/index.js";
import { logger } from "../../../infrastructure/shared/logging/index.js";
import type { KeyEncryptionService } from "../../../infrastructure/shared/crypto/index.js";
import { BatchRpcClient } from "./BatchRpcClient.js";
import { withRetry, pollWithBackoff, type PollResult } from "../../../infrastructure/shared/resilience/index.js";
import { toHumanAmountNumber } from "../../../infrastructure/shared/math/index.js";

/**
 * Solana BIP44 derivation path (compatible with Phantom, Solflare, etc.)
 * m/44'/501'/0'/0'
 * - 44' = BIP44 purpose
 * - 501' = Solana coin type
 * - 0' = account index
 * - 0' = change (external)
 */
const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

/**
 * Sanitize error messages to prevent leaking sensitive data (LOW-003).
 * Removes RPC URLs, base64 strings (potential keys/transactions), and other sensitive info.
 */
function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/[A-Za-z0-9+/]{40,}/g, "[REDACTED]") // Long base64 strings (keys, transactions)
    .replace(/https?:\/\/[^\s]+/g, "[RPC_URL]"); // RPC URLs
}

/**
 * Generated keypair with extractable private key
 */
export interface GeneratedKeypair {
  address: string;
  privateKeyBase64: string;
}

/**
 * Generated keypair with BIP39 mnemonic (Phantom/Solflare compatible)
 */
export interface GeneratedKeypairWithMnemonic extends GeneratedKeypair {
  mnemonic: string;
}

/**
 * Result of mnemonic validation
 */
export interface ValidateMnemonicResult {
  valid: boolean;
  address?: string;
  normalizedKey?: string;
  error?: string;
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
 * Result of sending a transaction
 */
export interface SendTransactionResult {
  success: boolean;
  signature: string | null;
  error: string | null;
  confirmed: boolean;
}

/**
 * Result of private key validation
 */
export interface ValidatePrivateKeyResult {
  valid: boolean;
  address?: string;
  normalizedKey?: string;
  error?: string;
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
 * Token configuration for batch balance fetching
 */
export interface TokenConfig {
  mint: string;
  decimals: number;
}

/**
 * Token account data structure from getTokenAccountsByOwner RPC
 */
interface TokenAccountResult {
  pubkey: string;
  account: {
    data: {
      parsed: {
        info: {
          tokenAmount: {
            amount: string;
            decimals: number;
            uiAmount: number | null;
            uiAmountString: string;
          };
        };
      };
    };
  };
}

export class SolanaRpcClient {
  private rpc: Rpc<SolanaRpcApi>;
  private batchClient: BatchRpcClient;

  constructor(config: SolanaConfig) {
    this.rpc = createSolanaRpc(config.rpcUrl);
    this.batchClient = new BatchRpcClient(config.rpcUrl);
  }

  /**
   * Get native SOL balance for a wallet address
   *
   * Note: This returns NATIVE SOL (lamports), not WSOL token balance.
   * Native SOL is used for:
   * - Transaction fees (priority fees, rent)
   * - Jupiter swaps (auto-wrapped to WSOL when needed)
   *
   * WSOL is a separate SPL token that we don't manage directly —
   * Jupiter handles wrap/unwrap automatically during swaps.
   */
  async getBalance(walletAddress: string): Promise<number> {
    const addr = address(walletAddress);
    // Use retry with exponential backoff for rate-limited requests
    const { value } = await withRetry(() => this.rpc.getBalance(addr).send());
    return toHumanAmountNumber(value.toString(), 9); // SOL has 9 decimals
  }

  /**
   * Get SPL token balance for a wallet
   * @param walletAddress - Wallet address to check
   * @param tokenMint - Token mint address
   * @param decimals - Token decimals (default 9)
   * @returns Token balance (0 if no token account exists)
   * @throws Error if RPC request fails
   */
  async getTokenBalance(walletAddress: string, tokenMint: string, _decimals: number = 9): Promise<number> {
    const owner = address(walletAddress);
    const mint = address(tokenMint);

    // Use retry with exponential backoff for rate-limited requests
    const result = await withRetry(() =>
      this.rpc
        .getTokenAccountsByOwner(
          owner,
          { mint },
          { encoding: "jsonParsed" },
        )
        .send()
    );

    // No token account = balance is legitimately 0
    if (result.value.length === 0) {
      return 0;
    }

    // Get the first token account (there should only be one per mint)
    const accountData = result.value[0].account.data;

    // Type guard for parsed data
    if (typeof accountData === "object" && "parsed" in accountData) {
      const parsed = accountData.parsed as {
        info: {
          tokenAmount: {
            amount: string;
            decimals: number;
            uiAmount: number | null;
            uiAmountString: string;
          };
        };
      };
      const tokenAmount = parsed.info.tokenAmount;

      // Use uiAmountString (more reliable) or fallback to calculating from raw amount
      // uiAmount can be null in some edge cases, so we avoid relying on it
      if (tokenAmount.uiAmountString) {
        return parseFloat(tokenAmount.uiAmountString);
      }

      // Fallback: calculate from raw amount and decimals
      if (tokenAmount.amount && tokenAmount.decimals !== undefined) {
        return toHumanAmountNumber(tokenAmount.amount, tokenAmount.decimals);
      }

      // Last resort: use uiAmount if available
      return tokenAmount.uiAmount ?? 0;
    }

    // Unexpected data format
    throw new Error("Unexpected token account data format");
  }

  /**
   * Get USDC balance for a wallet
   * @param walletAddress - Wallet address to check
   * @returns USDC balance
   */
  async getUsdcBalance(walletAddress: string): Promise<number> {
    // Circle USDC on Solana mainnet
    const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    return this.getTokenBalance(walletAddress, USDC_MINT, 6);
  }

  /**
   * Get all portfolio balances in a single batch RPC request.
   *
   * This combines 4 RPC calls into 1 HTTP request:
   * - getBalance (SOL)
   * - getTokenAccountsByOwner (BTC)
   * - getTokenAccountsByOwner (ETH)
   * - getTokenAccountsByOwner (USDC)
   *
   * Benefits:
   * - Reduces RPC billing (1 call instead of 4)
   * - Reduces rate limit consumption
   * - Reduces network overhead
   *
   * @param walletAddress - Wallet address to check
   * @param tokens - Token configurations for BTC, ETH, USDC
   * @returns All balances
   * @throws Error if batch request fails
   */
  async getAllBalancesBatch(
    walletAddress: string,
    tokens: {
      btc: TokenConfig;
      eth: TokenConfig;
      usdc: TokenConfig;
    },
  ): Promise<BatchBalancesResult> {
    logger.debug("Solana", "Fetching balances via batch RPC", {
      wallet: walletAddress.slice(0, 8),
    });

    // Build batch request for all 4 balances
    const [solResult, btcResult, ethResult, usdcResult] = await this.batchClient.batch<[
      // getBalance result
      { value: bigint },
      // getTokenAccountsByOwner results (BTC, ETH, USDC)
      { value: TokenAccountResult[] },
      { value: TokenAccountResult[] },
      { value: TokenAccountResult[] },
    ]>([
      // SOL balance
      {
        method: "getBalance",
        params: [walletAddress],
      },
      // BTC token account
      {
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { mint: tokens.btc.mint },
          { encoding: "jsonParsed" },
        ],
      },
      // ETH token account
      {
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { mint: tokens.eth.mint },
          { encoding: "jsonParsed" },
        ],
      },
      // USDC token account
      {
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { mint: tokens.usdc.mint },
          { encoding: "jsonParsed" },
        ],
      },
    ]);

    // Parse results
    const sol = toHumanAmountNumber(solResult.value.toString(), 9); // SOL has 9 decimals
    const btc = this.parseTokenAccountBalance(btcResult.value);
    const eth = this.parseTokenAccountBalance(ethResult.value);
    const usdc = this.parseTokenAccountBalance(usdcResult.value);

    logger.debug("Solana", "Batch balances fetched", {
      wallet: walletAddress.slice(0, 8),
      sol,
      btc,
      eth,
      usdc,
    });

    return { sol, btc, eth, usdc };
  }

  /**
   * Parse token account balance from getTokenAccountsByOwner result
   */
  private parseTokenAccountBalance(accounts: TokenAccountResult[]): number {
    // No token account = balance is 0
    if (accounts.length === 0) {
      return 0;
    }

    // Get the first token account
    const accountData = accounts[0].account.data;

    // Type guard for parsed data
    if (typeof accountData === "object" && "parsed" in accountData) {
      const parsed = accountData.parsed as {
        info: {
          tokenAmount: {
            amount: string;
            decimals: number;
            uiAmount: number | null;
            uiAmountString: string;
          };
        };
      };
      const tokenAmount = parsed.info.tokenAmount;

      // Use uiAmountString (most reliable)
      if (tokenAmount.uiAmountString) {
        return parseFloat(tokenAmount.uiAmountString);
      }

      // Fallback: calculate from raw amount and decimals
      if (tokenAmount.amount && tokenAmount.decimals !== undefined) {
        return toHumanAmountNumber(tokenAmount.amount, tokenAmount.decimals);
      }

      // Last resort: use uiAmount if available
      return tokenAmount.uiAmount ?? 0;
    }

    return 0;
  }

  isValidAddress(walletAddress: string): boolean {
    try {
      address(walletAddress);
      return true;
    } catch {
      return false;
    }
  }

  getRpc(): Rpc<SolanaRpcApi> {
    return this.rpc;
  }

  /**
   * Generate a new Solana keypair
   * Returns address and private key encoded as base64
   */
  async generateKeypair(): Promise<GeneratedKeypair> {
    // Generate extractable Ed25519 keypair via Web Crypto API
    const keyPair = (await crypto.subtle.generateKey(
      "Ed25519",
      true, // extractable = true (required for export)
      ["sign", "verify"],
    )) as CryptoKeyPair;

    // Export private key in PKCS8 format (raw format not supported for Ed25519 private keys)
    // PKCS8 structure for Ed25519: 16-byte header + 32-byte seed
    const pkcs8Bytes = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    const privateKeyBytes = new Uint8Array(pkcs8Bytes).slice(-32); // Extract 32-byte seed

    // Create signer from bytes to get the address
    const signer = await createKeyPairSignerFromPrivateKeyBytes(
      privateKeyBytes,
      true,
    );

    return {
      address: signer.address,
      privateKeyBase64: Buffer.from(privateKeyBytes).toString("base64"),
    };
  }

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

    // Convert mnemonic to seed (64 bytes)
    const seed = bip39.mnemonicToSeedSync(mnemonic);

    // Derive Ed25519 key using Solana's standard path
    const derived = derivePath(SOLANA_DERIVATION_PATH, seed.toString("hex"));
    const privateKeyBytes = derived.key;

    // Create signer from derived key to get the address
    const signer = await createKeyPairSignerFromPrivateKeyBytes(
      privateKeyBytes,
      true,
    );

    return {
      address: signer.address,
      privateKeyBase64: Buffer.from(privateKeyBytes).toString("base64"),
      mnemonic,
    };
  }

  /**
   * Derive keypair from an existing BIP39 mnemonic.
   * Uses standard Solana derivation path: m/44'/501'/0'/0'
   *
   * @param mnemonic - BIP39 mnemonic phrase (12 or 24 words)
   * @returns Generated keypair (without mnemonic in result)
   */
  async deriveKeypairFromMnemonic(mnemonic: string): Promise<GeneratedKeypair> {
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
      address: signer.address,
      privateKeyBase64: Buffer.from(privateKeyBytes).toString("base64"),
    };
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
      if (!this.isValidAddress(keypair.address)) {
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
   * Create a signer from a base64-encoded private key.
   * The input buffer is zeroed immediately after the signer is created
   * to minimize the time sensitive data remains in JS heap.
   */
  async createSignerFromPrivateKey(privateKeyBase64: string): Promise<KeyPairSigner> {
    const privateKeyBytes = Buffer.from(privateKeyBase64, "base64");
    try {
      const signer = await createKeyPairSignerFromPrivateKeyBytes(privateKeyBytes, true);
      return signer;
    } finally {
      // Zero the buffer to minimize exposure window
      privateKeyBytes.fill(0);
    }
  }

  /**
   * Get address from a base64-encoded private key
   */
  async getAddressFromPrivateKey(privateKeyBase64: string): Promise<string> {
    const signer = await this.createSignerFromPrivateKey(privateKeyBase64);
    return signer.address;
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
      const walletAddress = await this.getAddressFromPrivateKey(normalizedKey);

      // Verify the address is valid Solana format (base58, 32-44 chars)
      if (!this.isValidAddress(walletAddress)) {
        return { valid: false, error: "Derived address is not a valid Solana address" };
      }

      return { valid: true, address: walletAddress, normalizedKey };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { valid: false, error: `Invalid Solana private key: ${message}` };
    }
  }

  /**
   * Simulate a transaction without sending it to the network.
   * This is useful for checking if a transaction will succeed and how many compute units it will use.
   *
   * @param transactionBase64 - Base64 encoded serialized transaction (from Jupiter API)
   * @returns SimulationResult with success status, error, compute units, and logs
   */
  async simulateTransaction(transactionBase64: string): Promise<SimulationResult> {
    logger.step("Solana", 2, 2, "Simulating transaction...");

    try {
      const startTime = Date.now();

      // Call simulateTransaction RPC method
      // The transaction is already base64 encoded from Jupiter
      // Cast to branded type - Jupiter returns valid base64 transactions
      const result = await this.rpc
        .simulateTransaction(transactionBase64 as Base64EncodedWireTransaction, {
          encoding: "base64",
          commitment: "confirmed",
          replaceRecentBlockhash: true, // Use fresh blockhash for simulation
        })
        .send();

      const duration = Date.now() - startTime;
      const { value } = result;

      // Check if simulation succeeded
      const success = value.err === null;

      // Extract error message if present
      let errorMessage: string | null = null;
      if (value.err !== null) {
        if (typeof value.err === "string") {
          errorMessage = value.err;
        } else if (typeof value.err === "object") {
          errorMessage = JSON.stringify(value.err);
        }
      }

      const simulationResult = {
        success,
        error: errorMessage,
        unitsConsumed: value.unitsConsumed ? Number(value.unitsConsumed) : null,
        logs: value.logs ?? [],
      };

      if (success) {
        logger.tx("Solana", "Simulation SUCCESS", {
          unitsConsumed: simulationResult.unitsConsumed,
          duration: `${duration}ms`,
        });
      } else {
        logger.tx("Solana", "Simulation FAILED", {
          error: errorMessage,
          duration: `${duration}ms`,
        });
        // Log relevant transaction logs for debugging
        if (value.logs && value.logs.length > 0) {
          logger.debug("Solana", "Simulation logs", {
            logs: value.logs.slice(-10), // Last 10 logs
          });
        }
      }

      return simulationResult;
    } catch (error) {
      // Handle RPC errors - sanitize to prevent leaking sensitive data (LOW-003)
      const sanitizedMessage = sanitizeErrorMessage(error);
      logger.error("Solana", "Simulation RPC error", { error: sanitizedMessage });
      return {
        success: false,
        error: `Simulation RPC error: ${sanitizedMessage}`,
        unitsConsumed: null,
        logs: [],
      };
    }
  }

  /**
   * Sign and send a transaction to the network.
   *
   * Pipeline:
   * 1. Create signer from private key bytes
   * 2. Decode base64 transaction → bytes → Transaction object
   * 3. Sign with user's keypair (adds signature to transaction)
   * 4. Encode back: Transaction → bytes → base64
   * 5. Send to network via RPC
   * 6. Poll for confirmation (up to 30 seconds)
   *
   * @param transactionBase64 - Base64 encoded serialized transaction (from Jupiter API)
   * @param privateKeyBase64 - Base64 encoded private key for signing
   * @returns SendTransactionResult with signature, confirmation status, and any errors
   */
  async signAndSendTransaction(
    transactionBase64: string,
    privateKeyBase64: string,
  ): Promise<SendTransactionResult> {
    try {
      // 1. Create signer from private key
      logger.step("Solana", 1, 4, "Creating signer from private key...");
      const signer = await this.createSignerFromPrivateKey(privateKeyBase64);
      logger.debug("Solana", "Signer created", { address: signer.address });

      // 2. Decode base64 transaction to bytes
      logger.step("Solana", 2, 4, "Decoding and signing transaction...");
      const transactionBytes = Buffer.from(transactionBase64, "base64");

      // 3. Decode bytes to Transaction object
      const decoder = getTransactionDecoder();
      const transaction = decoder.decode(transactionBytes);

      // 4. Sign the transaction with the signer's keypair
      const signedTransaction = await signTransaction([signer.keyPair], transaction);

      // 5. Encode signed transaction back to base64
      const encoder = getTransactionEncoder();
      const signedBytes = encoder.encode(signedTransaction);
      const signedBase64 = Buffer.from(signedBytes).toString("base64") as Base64EncodedWireTransaction;

      // 6. Send the transaction
      logger.step("Solana", 3, 4, "Sending transaction to network...");
      const sendStartTime = Date.now();

      const signature = await this.rpc
        .sendTransaction(signedBase64, {
          encoding: "base64",
          skipPreflight: false,
          preflightCommitment: "confirmed",
        })
        .send();

      const sendDuration = Date.now() - sendStartTime;
      logger.tx("Solana", "Transaction sent", {
        signature,
        duration: `${sendDuration}ms`,
      });

      // 7. Wait for confirmation (poll for status)
      logger.step("Solana", 4, 4, "Waiting for confirmation...");
      const confirmStartTime = Date.now();
      const confirmed = await this.waitForConfirmation(signature, 30000); // 30 second timeout
      const confirmDuration = Date.now() - confirmStartTime;

      if (confirmed) {
        logger.tx("Solana", "Transaction CONFIRMED", {
          signature,
          confirmationTime: `${confirmDuration}ms`,
        });
      } else {
        logger.warn("Solana", "Transaction confirmation timeout", {
          signature,
          timeout: "30s",
        });
      }

      return {
        success: true,
        signature: signature,
        error: null,
        confirmed,
      };
    } catch (error) {
      // Sanitize error to prevent leaking sensitive data (LOW-003)
      const sanitizedMessage = sanitizeErrorMessage(error);
      logger.error("Solana", "Transaction failed", { error: sanitizedMessage });
      return {
        success: false,
        signature: null,
        error: sanitizedMessage,
        confirmed: false,
      };
    }
  }

  /**
   * Sign and send a transaction with ENCRYPTED private key.
   *
   * This is the secure signing method that minimizes private key exposure:
   * 1. Decrypt the encrypted key to a Buffer
   * 2. Create signer from bytes
   * 3. IMMEDIATELY zero the buffer (microseconds exposure)
   * 4. Sign and send transaction
   *
   * @param transactionBase64 - Base64 encoded serialized transaction (from Jupiter API)
   * @param encryptedPrivateKey - AES-256-GCM encrypted private key from database
   * @param encryptionService - Service to decrypt the key
   * @returns SendTransactionResult with signature, confirmation status, and any errors
   */
  async signAndSendTransactionSecure(
    transactionBase64: string,
    encryptedPrivateKey: string,
    encryptionService: KeyEncryptionService,
  ): Promise<SendTransactionResult> {
    try {
      // STEP 1: Decode transaction BEFORE decrypting key (no sensitive data yet)
      logger.step("Solana", 1, 4, "Decoding transaction...");
      const transactionBytes = Buffer.from(transactionBase64, "base64");
      const decoder = getTransactionDecoder();
      const transaction = decoder.decode(transactionBytes);

      // STEP 2: Decrypt, sign, and zero - all in minimal exposure window
      // Private key exists in memory ONLY during this block (~microseconds)
      logger.step("Solana", 2, 4, "Signing transaction (secure)...");

      let signedBase64: Base64EncodedWireTransaction;
      {
        // Decrypt key into buffer
        const decryptedBase64 = await encryptionService.decrypt(encryptedPrivateKey);
        const privateKeyBytes = Buffer.from(decryptedBase64, "base64");

        try {
          // Create signer with NON-extractable key (more secure)
          const signer = await createKeyPairSignerFromPrivateKeyBytes(privateKeyBytes, false);

          // Sign the transaction
          const signedTransaction = await signTransaction([signer.keyPair], transaction);

          // Encode signed transaction
          const encoder = getTransactionEncoder();
          const signedBytes = encoder.encode(signedTransaction);
          signedBase64 = Buffer.from(signedBytes).toString("base64") as Base64EncodedWireTransaction;

          // signer goes out of scope here - CryptoKey becomes eligible for GC
        } finally {
          // Zero the buffer IMMEDIATELY after signing
          privateKeyBytes.fill(0);
        }
        // decryptedBase64 string goes out of scope here
      }
      // PRIVATE KEY NO LONGER IN SCOPE - only signed transaction remains

      // STEP 3: Send the transaction (key already zeroed/out of scope)
      logger.step("Solana", 3, 4, "Sending transaction to network...");
      const sendStartTime = Date.now();

      const signature = await this.rpc
        .sendTransaction(signedBase64, {
          encoding: "base64",
          skipPreflight: false,
          preflightCommitment: "confirmed",
        })
        .send();

      const sendDuration = Date.now() - sendStartTime;
      logger.tx("Solana", "Transaction sent", {
        signature,
        duration: `${sendDuration}ms`,
      });

      // 7. Wait for confirmation (poll for status)
      logger.step("Solana", 4, 4, "Waiting for confirmation...");
      const confirmStartTime = Date.now();
      const confirmed = await this.waitForConfirmation(signature, 30000);
      const confirmDuration = Date.now() - confirmStartTime;

      if (confirmed) {
        logger.tx("Solana", "Transaction CONFIRMED", {
          signature,
          confirmationTime: `${confirmDuration}ms`,
        });
      } else {
        logger.warn("Solana", "Transaction confirmation timeout", {
          signature,
          timeout: "30s",
        });
      }

      return {
        success: true,
        signature: signature,
        error: null,
        confirmed,
      };
    } catch (error) {
      // Sanitize error to prevent leaking sensitive data (LOW-003)
      const sanitizedMessage = sanitizeErrorMessage(error);
      logger.error("Solana", "Transaction failed", { error: sanitizedMessage });
      return {
        success: false,
        signature: null,
        error: sanitizedMessage,
        confirmed: false,
      };
    }
  }

  /**
   * Wait for transaction confirmation by polling getSignatureStatuses.
   *
   * Solana commitment levels (in order of finality):
   * - processed: Transaction is in a block (may be rolled back)
   * - confirmed: Block has been voted on by supermajority (very unlikely to rollback)
   * - finalized: Block is rooted, 31+ confirmations (irreversible)
   *
   * We accept "confirmed" as sufficient - it's safe for most use cases
   * and much faster than waiting for "finalized" (~400ms vs ~13s).
   *
   * @param signature - Transaction signature to check
   * @param timeoutMs - Maximum time to wait in milliseconds
   * @returns true if confirmed, false if timed out or failed
   */
  private async waitForConfirmation(signature: Signature, timeoutMs: number): Promise<boolean> {
    const checkStatus = async (): Promise<PollResult<boolean>> => {
      const result = await this.rpc.getSignatureStatuses([signature]).send();

      const status = result.value[0];

      if (status !== null) {
        // Transaction explicitly failed (e.g., insufficient funds, program error)
        if (status.err !== null) {
          return { status: "failure", reason: "Transaction failed" };
        }

        // Accept both confirmed and finalized as success
        if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
          return { status: "success", value: true };
        }
      }

      // Status is null or pending - continue polling
      return { status: "timeout" };
    };

    const result = await pollWithBackoff(checkStatus, {
      timeoutMs,
      baseDelayMs: 1000,
      maxDelayMs: 4000,
    });

    return result.status === "success";
  }
}
