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

import { randomBytes } from "node:crypto";
import { SecretStoreRepository } from "../../../domain/repositories/SecretStoreRepository.js";
import { KeyEncryptionService } from "../../../infrastructure/shared/crypto/index.js";
import { logger } from "../../../infrastructure/shared/logging/index.js";

/** Default TTL: 5 minutes */
export const DEFAULT_SECRET_TTL_MS = 5 * 60 * 1000;

/** Token format: base64url, 22 characters (16 bytes) */
const TOKEN_REGEX = /^[A-Za-z0-9_-]{22}$/;

interface SecretEntry {
  encryptedPayload: string;
  createdAt: number;
  expiresAt: number;
  telegramId: number;
}

export interface SecretStoreConfig {
  ttlMs?: number;
  publicUrl: string;
}

export class SecretCache implements SecretStoreRepository {
  private secrets = new Map<string, SecretEntry>();
  private readonly ttlMs: number;
  private readonly publicUrl: string;

  constructor(
    private readonly encryptionService: KeyEncryptionService,
    config: SecretStoreConfig,
  ) {
    this.ttlMs = config.ttlMs ?? DEFAULT_SECRET_TTL_MS;
    this.publicUrl = config.publicUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  /**
   * Store a secret and return the one-time URL
   *
   * @param payload - The secret data (e.g., mnemonic phrase, private key)
   * @param telegramId - User ID for audit logging
   * @returns URL to access the secret once
   */
  async store(payload: string, telegramId: number): Promise<string> {
    // Generate cryptographically secure token (16 bytes = 128 bits entropy)
    const token = randomBytes(16).toString("base64url");

    // Encrypt payload before storing
    const encryptedPayload = await this.encryptionService.encrypt(payload);

    const now = Date.now();
    const entry: SecretEntry = {
      encryptedPayload,
      createdAt: now,
      expiresAt: now + this.ttlMs,
      telegramId,
    };

    this.secrets.set(token, entry);

    logger.debug("SecretCache", "Secret stored", {
      token: token.substring(0, 4) + "...",
      telegramId,
      expiresIn: `${this.ttlMs / 1000}s`,
    });

    return `${this.publicUrl}/secret/${token}`;
  }

  /**
   * Consume a secret (get and delete atomically)
   *
   * @param token - The secret token
   * @returns Decrypted payload or null if not found/expired/invalid
   */
  async consume(token: string): Promise<string | null> {
    // Validate token format first
    if (!TOKEN_REGEX.test(token)) {
      logger.debug("SecretCache", "Invalid token format");
      return null;
    }

    const entry = this.secrets.get(token);

    if (!entry) {
      logger.debug("SecretCache", "Secret not found", {
        token: token.substring(0, 4) + "...",
      });
      return null;
    }

    // Delete immediately (one-time access)
    this.secrets.delete(token);

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      logger.debug("SecretCache", "Secret expired", {
        token: token.substring(0, 4) + "...",
        telegramId: entry.telegramId,
      });
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
  deleteExpired(): number {
    const now = Date.now();
    let deleted = 0;

    for (const [token, entry] of this.secrets) {
      if (now > entry.expiresAt) {
        this.secrets.delete(token);
        deleted++;
      }
    }

    if (deleted > 0) {
      logger.debug("SecretCache", "Expired secrets cleaned up", { deleted });
    }

    return deleted;
  }

  /**
   * Get current store size (for monitoring)
   */
  size(): number {
    return this.secrets.size;
  }

  /**
   * Get TTL in minutes
   */
  getTtlMinutes(): number {
    return Math.round(this.ttlMs / 60000);
  }
}
