/**
 * Import wallet use case
 * Allows users to import an existing Solana wallet via private key
 */

import type { TelegramId, WalletAddress } from "../models/id/index.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { BlockchainRepository } from "../repositories/BlockchainRepository.js";
import type { OperationLockRepository } from "../repositories/OperationLockRepository.js";
import { ImportWalletResult } from "./types.js";
import { logger } from "../../infrastructure/shared/logging/index.js";
import { GetWalletInfoByAddressUseCase } from "./GetWalletInfoByAddressUseCase.js";
import { GetWalletInfoByPrivateKeyUseCase } from "./GetWalletInfoByPrivateKeyUseCase.js";
import { WalletCreationLock } from "../constants/WalletCreationLock.js";

// Maximum allowed input length to prevent DoS via large payloads
const MAX_INPUT_LENGTH = 512;

export class ImportWalletUseCase {
  constructor(
    private userRepository: UserRepository,
    private blockchainRepository: BlockchainRepository,
    private getWalletInfoByAddressUseCase: GetWalletInfoByAddressUseCase,
    private getWalletInfoByPrivateKeyUseCase: GetWalletInfoByPrivateKeyUseCase,
    private operationLockRepository: OperationLockRepository,
  ) {}

  async execute(telegramId: TelegramId, privateKeyBase64: string): Promise<ImportWalletResult> {
    // Validate input size before any processing (S-03 security measure)
    if (privateKeyBase64.length > MAX_INPUT_LENGTH) {
      return { type: "invalid_key" };
    }

    logger.info("ImportWallet", "Importing wallet", { telegramId });

    // Same lock as CreateWalletUseCase: create and import contend for the
    // same wallet slot, so a parallel create/import must not slip through
    // the exists-check below.
    const lockKey = WalletCreationLock.getKey(telegramId);
    const lockAcquired = await this.operationLockRepository.acquire(
      lockKey,
      WalletCreationLock.TTL_MS,
      Date.now(),
    );

    if (!lockAcquired) {
      logger.info("ImportWallet", "Wallet operation already in progress", { telegramId });
      return { type: "operation_in_progress" };
    }

    try {
      return await this.importLocked(telegramId, privateKeyBase64);
    } finally {
      await this.operationLockRepository.release(lockKey);
    }
  }

  private async importLocked(
    telegramId: TelegramId,
    privateKeyBase64: string,
  ): Promise<ImportWalletResult> {
    // Ensure user exists
    await this.userRepository.create(telegramId);

    // Check if wallet already exists
    const user = await this.userRepository.getById(telegramId);
    if (user?.privateKey && user?.walletAddress) {
      logger.info("ImportWallet", "Wallet already exists", { telegramId });
      // Use walletAddress instead of decrypting privateKey
      const wallet = await this.getWalletInfoByAddressUseCase.execute(user.walletAddress);
      return { type: "already_exists", wallet };
    }

    // Detect input type: mnemonic (words separated by spaces) or base64 private key
    const words = privateKeyBase64.trim().split(/\s+/);
    const isMnemonic = words.length >= 12 && words.length <= 24;

    let normalizedKey: string;
    let walletAddr: WalletAddress;

    if (isMnemonic) {
      // Validate as BIP39 mnemonic
      logger.debug("ImportWallet", "Detected mnemonic input");
      const mnemonicValidation = await this.blockchainRepository.validateMnemonic(privateKeyBase64);
      if (!mnemonicValidation.valid) {
        logger.warn("ImportWallet", "Invalid mnemonic", {
          telegramId,
          error: mnemonicValidation.error,
        });
        return { type: "invalid_key", error: mnemonicValidation.error };
      }
      normalizedKey = mnemonicValidation.normalizedKey!;
      walletAddr = mnemonicValidation.address!;
    } else {
      // Validate as base64 private key
      const validation = await this.blockchainRepository.validatePrivateKey(privateKeyBase64);
      if (!validation.valid) {
        logger.warn("ImportWallet", "Invalid private key", {
          telegramId,
          error: validation.error,
        });
        return { type: "invalid_key", error: validation.error };
      }
      normalizedKey = validation.normalizedKey!;
      walletAddr = validation.address!;
    }

    // Store the wallet atomically (key without address must never persist)
    await this.userRepository.setWalletData(telegramId, normalizedKey, walletAddr);

    logger.info("ImportWallet", "Wallet imported", {
      telegramId,
      address: walletAddr,
    });

    const wallet = await this.getWalletInfoByPrivateKeyUseCase.execute(normalizedKey);
    return { type: "imported", wallet };
  }
}
