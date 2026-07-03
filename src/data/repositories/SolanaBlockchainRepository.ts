/**
 * Solana Blockchain Repository Implementation
 *
 * Implements BlockchainRepository interface: key operations via
 * WalletKeyService, transaction operations via SolanaRpcClient.
 * Provides Dependency Inversion for domain layer.
 */

import type { WalletAddress } from "../../domain/models/id/index.js";
import type {
  BlockchainRepository,
  GeneratedKeypairWithMnemonic,
  ValidateMnemonicResult,
  ValidatePrivateKeyResult,
  SendTransactionResult,
} from "../../domain/repositories/BlockchainRepository.js";
import type { SolanaRpcClient } from "../sources/api/SolanaRpcClient.js";
import type { WalletKeyService } from "../sources/crypto/WalletKeyService.js";

export class SolanaBlockchainRepository implements BlockchainRepository {
  constructor(
    private client: SolanaRpcClient,
    private keyService: WalletKeyService,
  ) {}

  async getAddressFromPrivateKey(privateKeyBase64: string): Promise<WalletAddress> {
    return this.keyService.getAddressFromPrivateKey(privateKeyBase64);
  }

  async generateKeypairFromMnemonic(): Promise<GeneratedKeypairWithMnemonic> {
    return this.keyService.generateKeypairFromMnemonic();
  }

  async validateMnemonic(mnemonic: string): Promise<ValidateMnemonicResult> {
    return this.keyService.validateMnemonic(mnemonic);
  }

  async validatePrivateKey(privateKeyBase64: string): Promise<ValidatePrivateKeyResult> {
    return this.keyService.validatePrivateKey(privateKeyBase64);
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
}
