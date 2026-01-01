/**
 * SecretStoreRepository - interface for secure one-time secret storage
 *
 * Used for storing sensitive data (seed phrases, private keys) with:
 * - Encryption at rest
 * - TTL expiration
 * - One-time consumption
 */

import type { TelegramId } from "../models/id/index.js";

export interface SecretStoreRepository {
  /**
   * Store a secret and return the one-time URL
   *
   * @param payload - The secret data (e.g., mnemonic phrase, private key)
   * @param telegramId - User ID for audit logging
   * @returns URL to access the secret once
   */
  store(payload: string, telegramId: TelegramId): Promise<string>;

  /**
   * Consume a secret (get and delete atomically)
   *
   * @param token - The secret token
   * @returns Decrypted payload or null if not found/expired/invalid
   */
  consume(token: string): Promise<string | null>;

  /**
   * Get TTL in minutes (for user display)
   */
  getTtlMinutes(): number;
}
