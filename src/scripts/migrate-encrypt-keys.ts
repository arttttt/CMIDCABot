/**
 * Migration script: Encrypt existing unencrypted private keys
 *
 * This script migrates existing plaintext private keys in the database
 * to encrypted format using AES-256-GCM.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-encrypt-keys.ts
 *
 * Prerequisites:
 *   - MASTER_ENCRYPTION_KEY must be set in environment
 *   - Database must be accessible
 *
 * The script is idempotent - already encrypted keys are skipped.
 */

// Load .env file
try {
  process.loadEnvFile();
} catch {
  console.log("No .env file found, using environment variables");
}

import Database from "better-sqlite3";
import { getEncryptionService, initializeEncryption } from "../services/encryption.js";

// Plaintext base64 key is exactly 44 chars (32 bytes → base64)
// Encrypted data is longer due to IV (12) + authTag (16) overhead
const PLAINTEXT_KEY_LENGTH = 44;

interface UserRow {
  telegram_id: number;
  private_key: string | null;
}

async function main(): Promise<void> {
  const masterKey = process.env.MASTER_ENCRYPTION_KEY;
  const dbPath = process.env.DATABASE_PATH ?? "./data/bot.db";

  if (!masterKey) {
    console.error("Error: MASTER_ENCRYPTION_KEY environment variable is required");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("Private Key Encryption Migration");
  console.log("=".repeat(60));
  console.log(`Database: ${dbPath}`);
  console.log();

  // Initialize encryption service
  await initializeEncryption(masterKey);
  const encryption = getEncryptionService();

  // Open database directly (bypassing repository to avoid auto-decryption)
  const db = new Database(dbPath);

  try {
    // Get all users with private keys
    const users = db
      .prepare("SELECT telegram_id, private_key FROM users WHERE private_key IS NOT NULL AND private_key != ''")
      .all() as UserRow[];

    console.log(`Found ${users.length} user(s) with private keys`);
    console.log();

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      const { telegram_id, private_key } = user;

      if (!private_key) {
        skipped++;
        continue;
      }

      // Check if already encrypted (longer than plaintext key)
      if (encryption.isEncrypted(private_key)) {
        console.log(`  [SKIP] User ${telegram_id}: already encrypted`);
        skipped++;
        continue;
      }

      // Validate it looks like a valid base64 key
      if (private_key.length !== PLAINTEXT_KEY_LENGTH) {
        console.log(`  [WARN] User ${telegram_id}: unexpected key length ${private_key.length}, skipping`);
        skipped++;
        continue;
      }

      try {
        // Encrypt the key
        const encryptedKey = await encryption.encrypt(private_key);

        // Update in database
        db.prepare("UPDATE users SET private_key = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?").run(
          encryptedKey,
          telegram_id,
        );

        console.log(`  [OK] User ${telegram_id}: encrypted successfully`);
        migrated++;
      } catch (error) {
        console.error(`  [ERROR] User ${telegram_id}: ${error instanceof Error ? error.message : error}`);
        errors++;
      }
    }

    console.log();
    console.log("=".repeat(60));
    console.log("Migration Summary");
    console.log("=".repeat(60));
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped:  ${skipped}`);
    console.log(`  Errors:   ${errors}`);
    console.log();

    if (errors > 0) {
      console.log("WARNING: Some keys failed to migrate. Please investigate the errors above.");
      process.exit(1);
    }

    if (migrated > 0) {
      console.log("Migration completed successfully!");
      console.log("IMPORTANT: Make sure to backup your MASTER_ENCRYPTION_KEY securely.");
    } else {
      console.log("No keys needed migration.");
    }
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
