/**
 * SecretStore - in-memory storage for one-time secrets (seed phrases)
 *
 * Features:
 * - AES-256-GCM encryption of payload
 * - TTL with automatic expiration
 * - One-time consumption (get + delete atomically)
 * - Periodic cleanup of expired entries
 */

import { randomBytes } from "node:crypto";
import { KeyEncryptionService } from "./encryption.js";
import { logger } from "./logger.js";

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

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

export class SecretStore {
  private secrets = new Map<string, SecretEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private readonly ttlMs: number;
  private readonly publicUrl: string;

  constructor(
    private readonly encryptionService: KeyEncryptionService,
    config: SecretStoreConfig,
  ) {
    this.ttlMs = config.ttlMs ?? DEFAULT_TTL_MS;
    this.publicUrl = config.publicUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  /**
   * Start periodic cleanup of expired entries
   */
  startCleanup(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.deleteExpired();
    }, CLEANUP_INTERVAL_MS);

    // Don't prevent process exit
    this.cleanupTimer.unref();
  }

  /**
   * Stop periodic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Store a secret and return the one-time URL
   *
   * @param payload - The secret data (e.g., mnemonic phrase)
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

    logger.debug("SecretStore", "Secret stored", {
      token: token.substring(0, 8) + "...",
      telegramId,
      expiresIn: `${this.ttlMs / 1000}s`,
    });

    return `${this.publicUrl}/seed/${token}`;
  }

  /**
   * Consume a secret (get and delete atomically)
   *
   * @param token - The secret token
   * @returns Decrypted payload or null if not found/expired
   */
  async consume(token: string): Promise<string | null> {
    const entry = this.secrets.get(token);

    if (!entry) {
      logger.debug("SecretStore", "Secret not found", {
        token: token.substring(0, 8) + "...",
      });
      return null;
    }

    // Delete immediately (one-time access)
    this.secrets.delete(token);

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      logger.debug("SecretStore", "Secret expired", {
        token: token.substring(0, 8) + "...",
        telegramId: entry.telegramId,
      });
      return null;
    }

    logger.info("SecretStore", "Secret consumed", {
      token: token.substring(0, 8) + "...",
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
      logger.debug("SecretStore", "Expired secrets cleaned up", { deleted });
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
   * Get TTL in human-readable format
   */
  getTtlMinutes(): number {
    return Math.round(this.ttlMs / 60000);
  }
}
