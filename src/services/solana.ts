import {
  createSolanaRpc,
  address,
  type Rpc,
  type SolanaRpcApi,
  generateKeyPairSigner,
  createKeyPairSignerFromPrivateKeyBytes,
  type KeyPairSigner,
} from "@solana/web3.js";
import { SolanaConfig } from "../types/index.js";

const LAMPORTS_PER_SOL = 1_000_000_000n;

/**
 * Generated keypair with extractable private key
 */
export interface GeneratedKeypair {
  address: string;
  privateKeyBase64: string;
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
    const signer = await generateKeyPairSigner();

    // Export private key bytes using Web Crypto API
    const privateKeyBytes = await crypto.subtle.exportKey(
      "raw",
      signer.keyPair.privateKey,
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
}
