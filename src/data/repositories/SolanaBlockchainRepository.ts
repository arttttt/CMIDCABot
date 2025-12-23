/**
 * Solana Blockchain Repository Implementation
 *
 * Implements BlockchainRepository interface using SolanaRpcClient.
 * Provides Dependency Inversion for domain layer.
 */

import type {
  BlockchainRepository,
  GeneratedKeypair,
  GeneratedKeypairWithMnemonic,
  ValidateMnemonicResult,
  ValidatePrivateKeyResult,
  SendTransactionResult,
  SimulationResult,
  TokenConfig,
  BatchBalancesResult,
} from "../../domain/repositories/BlockchainRepository.js";
import type { KeyEncryptionService } from "../../infrastructure/internal/crypto/index.js";
import type { SolanaRpcClient } from "../sources/api/SolanaRpcClient.js";

export class SolanaBlockchainRepository implements BlockchainRepository {
  constructor(private client: SolanaRpcClient) {}

  // === Wallet Operations ===

  async getBalance(walletAddress: string): Promise<number> {
    return this.client.getBalance(walletAddress);
  }

  async getAddressFromPrivateKey(privateKeyBase64: string): Promise<string> {
    return this.client.getAddressFromPrivateKey(privateKeyBase64);
  }

  async generateKeypair(): Promise<GeneratedKeypair> {
    return this.client.generateKeypair();
  }

  async generateKeypairFromMnemonic(): Promise<GeneratedKeypairWithMnemonic> {
    return this.client.generateKeypairFromMnemonic();
  }

  async deriveKeypairFromMnemonic(mnemonic: string): Promise<GeneratedKeypair> {
    return this.client.deriveKeypairFromMnemonic(mnemonic);
  }

  async validateMnemonic(mnemonic: string): Promise<ValidateMnemonicResult> {
    return this.client.validateMnemonic(mnemonic);
  }

  async validatePrivateKey(privateKeyBase64: string): Promise<ValidatePrivateKeyResult> {
    return this.client.validatePrivateKey(privateKeyBase64);
  }

  isValidAddress(walletAddress: string): boolean {
    return this.client.isValidAddress(walletAddress);
  }

  // === Transaction Operations ===

  async signAndSendTransaction(
    transactionBase64: string,
    privateKeyBase64: string,
  ): Promise<SendTransactionResult> {
    return this.client.signAndSendTransaction(transactionBase64, privateKeyBase64);
  }

  async signAndSendTransactionSecure(
    transactionBase64: string,
    encryptedPrivateKey: string,
    encryptionService: KeyEncryptionService,
  ): Promise<SendTransactionResult> {
    return this.client.signAndSendTransactionSecure(
      transactionBase64,
      encryptedPrivateKey,
      encryptionService,
    );
  }

  async simulateTransaction(transactionBase64: string): Promise<SimulationResult> {
    return this.client.simulateTransaction(transactionBase64);
  }

  // === Token Operations ===

  async getTokenBalance(
    walletAddress: string,
    tokenMint: string,
    decimals?: number,
  ): Promise<number> {
    return this.client.getTokenBalance(walletAddress, tokenMint, decimals);
  }

  async getUsdcBalance(walletAddress: string): Promise<number> {
    return this.client.getUsdcBalance(walletAddress);
  }

  async getAllBalancesBatch(
    walletAddress: string,
    tokens: {
      btc: TokenConfig;
      eth: TokenConfig;
      usdc: TokenConfig;
    },
  ): Promise<BatchBalancesResult> {
    return this.client.getAllBalancesBatch(walletAddress, tokens);
  }
}
