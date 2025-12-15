/**
 * SQLite implementation of User repository using Kysely
 *
 * Private keys are encrypted before storage and decrypted on retrieval.
 * This provides data-at-rest encryption for sensitive key material.
 */
import { Kysely, sql, Selectable } from "kysely";
import { UserRepository } from "../../../domain/repositories/UserRepository.js";
import { User, UserWithWallet, UserWithDcaWallet, ActiveDcaUser } from "../../../domain/models/User.js";
import type { MainDatabase, UsersTable } from "../../types/database.js";
import { KeyEncryptionService } from "../../../services/encryption.js";

type UserRow = Selectable<UsersTable>;

export class SQLiteUserRepository implements UserRepository {
  constructor(
    private db: Kysely<MainDatabase>,
    private encryptionService: KeyEncryptionService,
  ) {}

  /**
   * Convert database row to domain model.
   * Note: privateKey remains encrypted here - use decryptPrivateKey() when needed.
   */
  private rowToModel(row: UserRow): User {
    return {
      telegramId: row.telegram_id,
      walletAddress: row.wallet_address,
      privateKey: row.private_key, // Still encrypted at this point
      isDcaActive: row.is_dca_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Decrypt a private key from storage.
   * Returns null if key is null/empty.
   */
  private async decryptPrivateKey(encryptedKey: string | null): Promise<string | null> {
    if (!encryptedKey) return null;
    return this.encryptionService.decrypt(encryptedKey);
  }

  /**
   * Encrypt a private key for storage.
   */
  private async encryptPrivateKey(plainKey: string): Promise<string> {
    return this.encryptionService.encrypt(plainKey);
  }

  async getById(telegramId: number): Promise<User | undefined> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where("telegram_id", "=", telegramId)
      .executeTakeFirst();

    if (!row) return undefined;

    const user = this.rowToModel(row);
    // Decrypt private key if present
    user.privateKey = await this.decryptPrivateKey(user.privateKey);
    return user;
  }

  async create(telegramId: number): Promise<void> {
    await this.db
      .insertInto("users")
      .values({ telegram_id: telegramId })
      .onConflict((oc) => oc.column("telegram_id").doNothing())
      .execute();
  }

  async setWalletAddress(telegramId: number, walletAddress: string): Promise<void> {
    await this.db
      .updateTable("users")
      .set({
        wallet_address: walletAddress,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where("telegram_id", "=", telegramId)
      .execute();
  }

  async getAllWithWallet(): Promise<UserWithWallet[]> {
    const rows = await this.db
      .selectFrom("users")
      .select(["telegram_id", "wallet_address"])
      .where("wallet_address", "is not", null)
      .where("wallet_address", "!=", "")
      .execute();

    return rows.map((row) => ({
      telegramId: row.telegram_id,
      walletAddress: row.wallet_address!,
    }));
  }

  async setPrivateKey(telegramId: number, privateKey: string): Promise<void> {
    // Encrypt private key before storage
    const encryptedKey = await this.encryptPrivateKey(privateKey);

    await this.db
      .updateTable("users")
      .set({
        private_key: encryptedKey,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where("telegram_id", "=", telegramId)
      .execute();
  }

  async clearPrivateKey(telegramId: number): Promise<void> {
    await this.db
      .updateTable("users")
      .set({
        private_key: null,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where("telegram_id", "=", telegramId)
      .execute();
  }

  async getAllWithDcaWallet(): Promise<UserWithDcaWallet[]> {
    const rows = await this.db
      .selectFrom("users")
      .select(["telegram_id", "private_key"])
      .where("private_key", "is not", null)
      .where("private_key", "!=", "")
      .execute();

    // Decrypt all private keys
    const results: UserWithDcaWallet[] = [];
    for (const row of rows) {
      const decryptedKey = await this.decryptPrivateKey(row.private_key);
      if (decryptedKey) {
        results.push({
          telegramId: row.telegram_id,
          privateKey: decryptedKey,
        });
      }
    }
    return results;
  }

  async setDcaActive(telegramId: number, active: boolean): Promise<void> {
    await this.db
      .updateTable("users")
      .set({
        is_dca_active: active ? 1 : 0,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where("telegram_id", "=", telegramId)
      .execute();
  }

  async getAllActiveDcaUsers(): Promise<ActiveDcaUser[]> {
    const rows = await this.db
      .selectFrom("users")
      .select(["telegram_id", "wallet_address"])
      .where("wallet_address", "is not", null)
      .where("wallet_address", "!=", "")
      .where("is_dca_active", "=", 1)
      .execute();

    return rows.map((row) => ({
      telegramId: row.telegram_id,
      walletAddress: row.wallet_address!,
    }));
  }

  async hasActiveDcaUsers(): Promise<boolean> {
    const result = await this.db
      .selectFrom("users")
      .select("telegram_id")
      .where("wallet_address", "is not", null)
      .where("wallet_address", "!=", "")
      .where("is_dca_active", "=", 1)
      .limit(1)
      .executeTakeFirst();

    return result !== undefined;
  }
}
