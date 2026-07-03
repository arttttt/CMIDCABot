/**
 * SecretCache - in-memory storage for one-time secrets (seed phrases, private keys)
 *
 * Features:
 * - AES-256-GCM encryption of payload
 * - TTL with automatic expiration
 * - One-time consumption (get + delete atomically)
 * - Token format validation
 *
 * Note: Cleanup is handled by SecretCleanupScheduler (SRP)
 */

import { KeyEncryptionService } from "../../../infrastructure/internal/crypto/index.js";
import { logger } from "../../../infrastructure/shared/logging/index.js";
import type { TelegramId } from "../../../domain/models/id/index.js";
import { TtlOneTimeStore } from "./TtlOneTimeStore.js";

/** Default TTL: 5 minutes */
export const DEFAULT_SECRET_TTL_MS = 5 * 60 * 1000;

interface SecretEntry {
  encryptedPayload: string;
  telegramId: number;
}

export interface SecretStoreConfig {
  ttlMs?: number;
  publicUrl: string;
}

export class SecretCache {
  private readonly secrets: TtlOneTimeStore<SecretEntry>;
  private readonly ttlMs: number;
  private readonly publicUrl: string;

  constructor(
    private readonly encryptionService: KeyEncryptionService,
    config: SecretStoreConfig,
  ) {
    this.ttlMs = config.ttlMs ?? DEFAULT_SECRET_TTL_MS;
    this.publicUrl = config.publicUrl.replace(/\/$/, ""); // Remove trailing slash
    this.secrets = new TtlOneTimeStore<SecretEntry>("SecretCache", this.ttlMs);
  }

  /**
   * Store a secret and return the one-time URL
   *
   * @param payload - The secret data (e.g., mnemonic phrase, private key)
   * @param telegramId - User ID for audit logging
   * @returns URL to access the secret once
   */
  async store(payload: string, telegramId: TelegramId): Promise<string> {
    // Encrypt payload before storing
    const encryptedPayload = await this.encryptionService.encrypt(payload);

    const token = this.secrets.put({
      encryptedPayload,
      telegramId: telegramId.value,
    });

    logger.debug("SecretCache", "Secret stored", { telegramId: telegramId.value });

    return `${this.publicUrl}/secret/${token}`;
  }

  /**
   * Consume a secret (get and delete atomically)
   *
   * @param token - The secret token
   * @returns Decrypted payload or null if not found/expired/invalid
   */
  async consume(token: string): Promise<string | null> {
    const entry = this.secrets.consume(token);
    if (!entry) {
      return null;
    }

    logger.info("SecretCache", "Secret consumed", {
      token: token.substring(0, 4) + "...",
      telegramId: entry.telegramId,
    });

    // Decrypt and return
    return this.encryptionService.decrypt(entry.encryptedPayload);
  }

  /**
   * Delete all expired entries
   *
   * @returns Number of deleted entries
   */
  async deleteExpired(): Promise<number> {
    return this.secrets.deleteExpired();
  }

  /**
   * Get current store size (for monitoring)
   */
  size(): number {
    return this.secrets.size();
  }

  /**
   * Get TTL in minutes
   */
  getTtlMinutes(): number {
    return Math.round(this.ttlMs / 60000);
  }
}
