/**
 * SecretStoreRepository - interface for secure one-time secret storage
 *
 * Used for storing sensitive data (seed phrases, private keys) with:
 * - Encryption at rest
 * - TTL expiration
 * - One-time consumption
 */

export interface SecretStoreRepository {
  /**
   * Store a secret and return the one-time URL
   *
   * @param payload - The secret data (e.g., mnemonic phrase, private key)
   * @param telegramId - User ID for audit logging
   * @returns URL to access the secret once
   */
  store(payload: string, telegramId: number): Promise<string>;

  /**
   * Get TTL in minutes (for user display)
   */
  getTtlMinutes(): number;
}
