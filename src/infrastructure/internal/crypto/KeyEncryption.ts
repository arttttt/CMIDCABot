/**
 * Key Encryption Service
 *
 * Provides AES-256-GCM encryption for private keys with two levels of protection:
 * 1. Data encryption in database - keys are encrypted before storage
 * 2. Memory protection - master key stored as non-extractable CryptoKey
 *
 * Algorithm: AES-256-GCM
 * - 256-bit key for strong encryption
 * - GCM mode provides both confidentiality and authenticity
 * - Random 12-byte IV for each encryption (prevents pattern analysis)
 * - 16-byte authentication tag (detects tampering)
 *
 * Format: base64(IV || ciphertext || authTag)
 * - IV: 12 bytes (random, unique per encryption)
 * - Ciphertext: encrypted data
 * - AuthTag: 16 bytes (included in ciphertext by Web Crypto)
 */

import { logger } from "../../shared/logging/index.js";

const IV_LENGTH = 12; // 96 bits - recommended for AES-GCM
const KEY_LENGTH = 32; // 256 bits
const AUTH_TAG_LENGTH = 16; // 128 bits - GCM authentication tag
const MIN_PRIVATE_KEY_LENGTH = 32; // Minimum expected private key size in bytes

export class KeyEncryptionService {
  private masterKey: CryptoKey | null = null;
  private initialized = false;

  /**
   * Initialize the encryption service with a master key from environment.
   * The key is imported as non-extractable CryptoKey for memory protection.
   *
   * @param masterKeyBase64 - Base64-encoded 32-byte master key
   * @throws Error if key is invalid or wrong length
   */
  async initialize(masterKeyBase64: string): Promise<void> {
    if (this.initialized) {
      logger.warn("Encryption", "Service already initialized");
      return;
    }

    // Decode and validate key length
    const keyBuffer = Buffer.from(masterKeyBase64, "base64");

    if (keyBuffer.length !== KEY_LENGTH) {
      throw new Error(
        `Master encryption key must be exactly ${KEY_LENGTH} bytes (got ${keyBuffer.length}). ` +
          `Generate with: openssl rand -base64 32`,
      );
    }

    // Import as non-extractable CryptoKey
    // This stores the key in native memory, not JS heap
    // extractable: false prevents crypto.subtle.exportKey()
    this.masterKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM" },
      false, // extractable = false for security
      ["encrypt", "decrypt"],
    );

    // Wipe the temporary buffer
    keyBuffer.fill(0);

    this.initialized = true;
    logger.info("Encryption", "Master key loaded successfully");
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Encrypt a private key for storage in database.
   *
   * @param plaintext - The private key (base64 string) to encrypt
   * @returns Base64-encoded encrypted data (IV + ciphertext + authTag)
   * @throws Error if service not initialized
   */
  async encrypt(plaintext: string): Promise<string> {
    if (!this.masterKey) {
      throw new Error("Encryption service not initialized");
    }

    // Generate random IV (unique for each encryption)
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Encrypt using AES-256-GCM
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.masterKey,
      new TextEncoder().encode(plaintext),
    );

    // Combine IV + ciphertext (authTag is appended by GCM)
    const result = new Uint8Array(iv.length + ciphertext.byteLength);
    result.set(iv);
    result.set(new Uint8Array(ciphertext), iv.length);

    return Buffer.from(result).toString("base64");
  }

  /**
   * Decrypt a private key retrieved from database.
   *
   * @param encryptedBase64 - Base64-encoded encrypted data
   * @returns The decrypted private key (base64 string)
   * @throws Error if service not initialized or decryption fails
   */
  async decrypt(encryptedBase64: string): Promise<string> {
    if (!this.masterKey) {
      throw new Error("Encryption service not initialized");
    }

    const data = Buffer.from(encryptedBase64, "base64");

    if (data.length < IV_LENGTH + 16) {
      // Minimum: IV + auth tag
      throw new Error("Invalid encrypted data: too short");
    }

    // Extract IV and ciphertext
    const iv = data.subarray(0, IV_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH);

    // Decrypt using AES-256-GCM
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, this.masterKey, ciphertext);

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Decrypt a private key to a Buffer for cryptographic operations.
   * The caller MUST zero the buffer immediately after importing to CryptoKey.
   *
   * @param encryptedBase64 - Base64-encoded encrypted private key
   * @returns Buffer containing decrypted key bytes (caller must zero after use)
   */
  async decryptToBuffer(encryptedBase64: string): Promise<Buffer> {
    const decryptedBase64 = await this.decrypt(encryptedBase64);
    return Buffer.from(decryptedBase64, "base64");
  }

  /**
   * Check if a value appears to be encrypted (vs plaintext base64 key).
   * Encrypted values have specific format: base64(IV || ciphertext || authTag)
   *
   * Validation checks:
   * 1. Must be valid base64 string
   * 2. Decoded length must be at least 60 bytes:
   *    - IV: 12 bytes
   *    - Minimum ciphertext: 32 bytes (for private key)
   *    - AuthTag: 16 bytes
   *
   * Plaintext 32-byte key in base64 = 44 characters (decodes to 32 bytes)
   * Encrypted: base64(12 + 32 + 16) = 80 characters minimum (decodes to 60 bytes)
   *
   * This is used during migration to detect unencrypted keys.
   */
  isEncrypted(value: string): boolean {
    // Empty or very short strings cannot be encrypted data
    if (!value || value.length < 80) {
      return false;
    }

    // Check if string has valid base64 format
    // Base64 uses A-Z, a-z, 0-9, +, / and = for padding
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(value)) {
      return false;
    }

    // Valid base64 length must be divisible by 4
    if (value.length % 4 !== 0) {
      return false;
    }

    try {
      const decoded = Buffer.from(value, "base64");

      // Minimum encrypted data length:
      // IV (12 bytes) + minimum ciphertext (32 bytes) + AuthTag (16 bytes) = 60 bytes
      const minEncryptedLength = IV_LENGTH + MIN_PRIVATE_KEY_LENGTH + AUTH_TAG_LENGTH;
      if (decoded.length < minEncryptedLength) {
        return false;
      }

      // Additional structural check: the data after IV should have enough space
      // for both ciphertext and auth tag
      const ciphertextAndTagLength = decoded.length - IV_LENGTH;
      if (ciphertextAndTagLength < MIN_PRIVATE_KEY_LENGTH + AUTH_TAG_LENGTH) {
        return false;
      }

      return true;
    } catch {
      // If base64 decoding fails, it's not valid encrypted data
      return false;
    }
  }
}

// Singleton instance
let encryptionService: KeyEncryptionService | null = null;

/**
 * Get the singleton encryption service instance.
 * Must be initialized before use via initializeEncryption().
 */
export function getEncryptionService(): KeyEncryptionService {
  if (!encryptionService) {
    encryptionService = new KeyEncryptionService();
  }
  return encryptionService;
}

/**
 * Initialize the encryption service with master key from environment.
 * Should be called once at application startup.
 *
 * @param masterKeyBase64 - Base64-encoded 32-byte master key
 */
export async function initializeEncryption(masterKeyBase64: string): Promise<void> {
  const service = getEncryptionService();
  await service.initialize(masterKeyBase64);
}
