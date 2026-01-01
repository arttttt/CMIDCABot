/**
 * Solana Blockchain Repository Implementation
 *
 * Implements BlockchainRepository interface using SolanaRpcClient.
 * Provides Dependency Inversion for domain layer.
 */

import type { TokenMint, WalletAddress } from "../../domain/models/id/index.js";
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
import type { SolanaRpcClient } from "../sources/api/SolanaRpcClient.js";

export class SolanaBlockchainRepository implements BlockchainRepository {
  constructor(private client: SolanaRpcClient) {}

  // === Wallet Operations ===

  async getBalance(addr: WalletAddress): Promise<number> {
    return this.client.getBalance(addr.value);
  }

  async getAddressFromPrivateKey(privateKeyBase64: string): Promise<WalletAddress> {
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

  isValidAddress(addr: string): boolean {
    return this.client.isValidAddress(addr);
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
  ): Promise<SendTransactionResult> {
    return this.client.signAndSendTransactionSecure(
      transactionBase64,
      encryptedPrivateKey,
    );
  }

  async simulateTransaction(transactionBase64: string): Promise<SimulationResult> {
    return this.client.simulateTransaction(transactionBase64);
  }

  // === Token Operations ===

  async getTokenBalance(
    addr: WalletAddress,
    mint: TokenMint,
    decimals?: number,
  ): Promise<number> {
    return this.client.getTokenBalance(addr.value, mint.value, decimals);
  }

  async getUsdcBalance(addr: WalletAddress): Promise<number> {
    return this.client.getUsdcBalance(addr.value);
  }

  async getAllBalancesBatch(
    addr: WalletAddress,
    tokens: {
      btc: TokenConfig;
      eth: TokenConfig;
      usdc: TokenConfig;
    },
  ): Promise<BatchBalancesResult> {
    // Cast TokenMint to string for the client
    const clientTokens = {
      btc: { mint: tokens.btc.mint, decimals: tokens.btc.decimals },
      eth: { mint: tokens.eth.mint, decimals: tokens.eth.decimals },
      usdc: { mint: tokens.usdc.mint, decimals: tokens.usdc.decimals },
    };
    return this.client.getAllBalancesBatch(addr.value, clientTokens);
  }
}
