/**
 * Export wallet key use case
 *
 * Exports the private key via a one-time secure URL.
 * The decrypted key is stored in SecretStore and shown only once.
 */

import type { TelegramId } from "../models/id/index.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { SecretStoreRepository } from "../repositories/SecretStoreRepository.js";
import { ExportKeyResult } from "./types.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class ExportWalletKeyUseCase {
  constructor(
    private userRepository: UserRepository,
    private secretStore: SecretStoreRepository,
  ) {}

  async execute(telegramId: TelegramId): Promise<ExportKeyResult> {
    logger.info("ExportWalletKey", "Exporting wallet key", { telegramId });

    // Get decrypted key from repository
    const decryptedKey = await this.userRepository.getDecryptedPrivateKey(telegramId);

    if (!decryptedKey) {
      logger.warn("ExportWalletKey", "No wallet to export", { telegramId });
      return { type: "no_wallet" };
    }

    // Store in SecretStore and return one-time URL
    const keyUrl = await this.secretStore.store(decryptedKey, telegramId);

    logger.info("ExportWalletKey", "Wallet key export URL generated", { telegramId });
    return {
      type: "success",
      keyUrl,
    };
  }
}
