import {
  createSolanaRpc,
  address,
  type Rpc,
  type SolanaRpcApi,
  createKeyPairSignerFromPrivateKeyBytes,
  type Signature,
  type Base64EncodedWireTransaction,
  getTransactionDecoder,
  getTransactionEncoder,
  signTransaction,
} from "@solana/kit";
import { SolanaConfig } from "../../../infrastructure/shared/config/index.js";
import { logger, LogSanitizer } from "../../../infrastructure/shared/logging/index.js";
import type { KeyEncryptionService } from "../../../infrastructure/internal/crypto/index.js";
import { BatchRpcClient } from "./BatchRpcClient.js";
import { Retry, type PollResult } from "../../../infrastructure/shared/resilience/index.js";
import { Precision } from "../../../infrastructure/shared/math/index.js";

/**
 * Transaction confirmation status after sending
 */
type ConfirmationStatus = "confirmed" | "timeout" | "failed";

import { TxSignature, type TokenMint } from "../../../domain/models/id/index.js";
import type { SendTransactionResult } from "../../../domain/repositories/BlockchainRepository.js";

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
  mint: TokenMint;
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
  private encryptionService: KeyEncryptionService;

  constructor(config: SolanaConfig, encryptionService: KeyEncryptionService) {
    this.rpc = createSolanaRpc(config.rpcUrl);
    this.batchClient = new BatchRpcClient(config.rpcUrl);
    this.encryptionService = encryptionService;
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
    const { value } = await Retry.withRetry(() => this.rpc.getBalance(addr).send());
    return Precision.toHumanAmountNumber(value.toString(), 9); // SOL has 9 decimals
  }

  /**
   * Get SPL token balance for a wallet
   * @param walletAddress - Wallet address to check
   * @param tokenMint - Token mint address
   * @returns Token balance (0 if no token account exists)
   * @throws Error if RPC request fails
   */
  async getTokenBalance(walletAddress: string, tokenMint: string): Promise<number> {
    const owner = address(walletAddress);
    const mint = address(tokenMint);

    // Use retry with exponential backoff for rate-limited requests
    const result = await Retry.withRetry(() =>
      this.rpc
        .getTokenAccountsByOwner(
          owner,
          { mint },
          { encoding: "jsonParsed" },
        )
        .send()
    );

    return this.parseTokenAccountBalance(result.value as unknown as TokenAccountResult[]);
  }

  /**
   * Get USDC balance for a wallet
   * @param walletAddress - Wallet address to check
   * @returns USDC balance
   */
  async getUsdcBalance(walletAddress: string): Promise<number> {
    // Circle USDC on Solana mainnet
    const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    return this.getTokenBalance(walletAddress, USDC_MINT);
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
          { mint: tokens.btc.mint.value },
          { encoding: "jsonParsed" },
        ],
      },
      // ETH token account
      {
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { mint: tokens.eth.mint.value },
          { encoding: "jsonParsed" },
        ],
      },
      // USDC token account
      {
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { mint: tokens.usdc.mint.value },
          { encoding: "jsonParsed" },
        ],
      },
    ]);

    // Parse results
    const sol = Precision.toHumanAmountNumber(solResult.value.toString(), 9); // SOL has 9 decimals
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
        return Precision.toHumanAmountNumber(tokenAmount.amount, tokenAmount.decimals);
      }

      // Last resort: use uiAmount if available
      return tokenAmount.uiAmount ?? 0;
    }

    // Unexpected data format: fail loudly rather than treat as zero balance
    throw new Error("Unexpected token account data format");
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
   * @returns SendTransactionResult with signature, confirmation status, and any errors
   */
  async signAndSendTransactionSecure(
    transactionBase64: string,
    encryptedPrivateKey: string,
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
        const decryptedBase64 = await this.encryptionService.decrypt(encryptedPrivateKey);
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
      const confirmationStatus = await this.waitForConfirmation(signature, 30000);
      const confirmDuration = Date.now() - confirmStartTime;

      return this.buildConfirmationResult(confirmationStatus, signature, confirmDuration);
    } catch (error) {
      // Sanitize error to prevent leaking sensitive data (LOW-003)
      const sanitizedMessage = LogSanitizer.sanitizeApiError(error);
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
   * Build SendTransactionResult based on confirmation status.
   * Handles logging and result construction for all confirmation outcomes.
   */
  private buildConfirmationResult(
    confirmationStatus: ConfirmationStatus,
    sig: string,
    confirmDuration: number,
  ): SendTransactionResult {
    const brandedSig = new TxSignature(sig);
    if (confirmationStatus === "confirmed") {
      logger.tx("Solana", "Transaction CONFIRMED", {
        signature: sig,
        confirmationTime: `${confirmDuration}ms`,
      });
      return {
        success: true,
        signature: brandedSig,
        error: null,
        confirmed: true,
      };
    } else if (confirmationStatus === "failed") {
      logger.error("Solana", "Transaction FAILED on-chain", {
        signature: sig,
        confirmationTime: `${confirmDuration}ms`,
      });
      return {
        success: false,
        signature: brandedSig,
        error: "Transaction failed on-chain",
        confirmed: false,
      };
    } else {
      // timeout
      logger.warn("Solana", "Transaction confirmation timeout", {
        signature: sig,
        timeout: "30s",
      });
      return {
        success: true,
        signature: brandedSig,
        error: null,
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
   * @returns "confirmed" if confirmed, "timeout" if timed out, "failed" if transaction failed on-chain
   */
  private async waitForConfirmation(signature: Signature, timeoutMs: number): Promise<ConfirmationStatus> {
    const checkStatus = async (): Promise<PollResult<ConfirmationStatus>> => {
      const result = await this.rpc.getSignatureStatuses([signature]).send();

      const status = result.value[0];

      if (status !== null) {
        // Transaction explicitly failed (e.g., insufficient funds, program error)
        if (status.err !== null) {
          return { status: "success", value: "failed" };
        }

        // Accept both confirmed and finalized as success
        if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
          return { status: "success", value: "confirmed" };
        }
      }

      // Status is null or pending - continue polling
      return { status: "timeout" };
    };

    const result = await Retry.pollWithBackoff(checkStatus, {
      timeoutMs,
      baseDelayMs: 1000,
      maxDelayMs: 4000,
    });

    // If poll timed out, return "timeout"
    if (result.status !== "success") {
      return "timeout";
    }

    return result.value;
  }
}
