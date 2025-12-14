import {
  createSolanaRpc,
  address,
  type Rpc,
  type SolanaRpcApi,
  createKeyPairSignerFromPrivateKeyBytes,
  type KeyPairSigner,
  type Signature,
} from "@solana/web3.js";
import {
  type Base64EncodedWireTransaction,
  getTransactionDecoder,
  getTransactionEncoder,
  signTransaction,
} from "@solana/transactions";
import { SolanaConfig } from "../types/index.js";

const LAMPORTS_PER_SOL = 1_000_000_000n;

/**
 * Generated keypair with extractable private key
 */
export interface GeneratedKeypair {
  address: string;
  privateKeyBase64: string;
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

export class SolanaService {
  private rpc: Rpc<SolanaRpcApi>;
  private config: SolanaConfig;

  constructor(config: SolanaConfig) {
    this.config = config;
    this.rpc = createSolanaRpc(config.rpcUrl);
  }

  async getBalance(walletAddress: string): Promise<number> {
    const addr = address(walletAddress);
    const { value } = await this.rpc.getBalance(addr).send();
    return Number(value) / Number(LAMPORTS_PER_SOL);
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

  getNetwork(): string {
    return this.config.network;
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
   * Create a signer from a base64-encoded private key
   */
  async createSignerFromPrivateKey(privateKeyBase64: string): Promise<KeyPairSigner> {
    const privateKeyBytes = Buffer.from(privateKeyBase64, "base64");
    return createKeyPairSignerFromPrivateKeyBytes(privateKeyBytes, true);
  }

  /**
   * Get address from a base64-encoded private key
   */
  async getAddressFromPrivateKey(privateKeyBase64: string): Promise<string> {
    const signer = await this.createSignerFromPrivateKey(privateKeyBase64);
    return signer.address;
  }

  /**
   * Simulate a transaction without sending it to the network.
   * This is useful for checking if a transaction will succeed and how many compute units it will use.
   *
   * @param transactionBase64 - Base64 encoded serialized transaction (from Jupiter API)
   * @returns SimulationResult with success status, error, compute units, and logs
   */
  async simulateTransaction(transactionBase64: string): Promise<SimulationResult> {
    try {
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

      return {
        success,
        error: errorMessage,
        unitsConsumed: value.unitsConsumed ? Number(value.unitsConsumed) : null,
        logs: value.logs ?? [],
      };
    } catch (error) {
      // Handle RPC errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Simulation RPC error: ${errorMessage}`,
        unitsConsumed: null,
        logs: [],
      };
    }
  }

  /**
   * Sign and send a transaction to the network.
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
      const signer = await this.createSignerFromPrivateKey(privateKeyBase64);

      // 2. Decode base64 transaction to bytes
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
      const signature = await this.rpc
        .sendTransaction(signedBase64, {
          encoding: "base64",
          skipPreflight: false,
          preflightCommitment: "confirmed",
        })
        .send();

      // 7. Wait for confirmation (poll for status)
      const confirmed = await this.waitForConfirmation(signature, 30000); // 30 second timeout

      return {
        success: true,
        signature: signature,
        error: null,
        confirmed,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        signature: null,
        error: errorMessage,
        confirmed: false,
      };
    }
  }

  /**
   * Wait for transaction confirmation by polling getSignatureStatuses.
   *
   * @param signature - Transaction signature to check
   * @param timeoutMs - Maximum time to wait in milliseconds
   * @returns true if confirmed, false if timed out or failed
   */
  private async waitForConfirmation(signature: Signature, timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    const pollIntervalMs = 1000; // Poll every second

    while (Date.now() - startTime < timeoutMs) {
      try {
        const result = await this.rpc
          .getSignatureStatuses([signature])
          .send();

        const status = result.value[0];

        if (status !== null) {
          // Check if transaction failed
          if (status.err !== null) {
            return false;
          }

          // Check if confirmed or finalized
          if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
            return true;
          }
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      } catch {
        // Ignore errors and keep polling
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }

    // Timeout reached
    return false;
  }
}
