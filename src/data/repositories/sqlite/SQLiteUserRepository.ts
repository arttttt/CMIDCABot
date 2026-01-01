/**
 * SQLite implementation of User repository using Kysely
 *
 * Private keys are encrypted at rest using AES-256-GCM.
 * Keys are stored encrypted and returned encrypted - decryption happens
 * only at the moment of signing (in SolanaRpcClient) to minimize exposure.
 */
import { Kysely, sql, Selectable } from "kysely";
import { UserRepository } from "../../../domain/repositories/UserRepository.js";
import { User, UserWithWallet, UserWithDcaWallet, ActiveDcaUser } from "../../../domain/models/User.js";
import { TelegramId, WalletAddress } from "../../../domain/models/id/index.js";
import type { MainDatabase, UsersTable } from "../../types/database.js";
import { KeyEncryptionService } from "../../../infrastructure/internal/crypto/index.js";

type UserRow = Selectable<UsersTable>;

export class SQLiteUserRepository implements UserRepository {
  constructor(
    private db: Kysely<MainDatabase>,
    private encryptionService: KeyEncryptionService,
  ) {}

  /**
   * Convert database row to domain model.
   * privateKey remains ENCRYPTED - decryption happens only at signing time.
   */
  private rowToModel(row: UserRow): User {
    return {
      telegramId: new TelegramId(row.telegram_id),
      walletAddress: row.wallet_address ? new WalletAddress(row.wallet_address) : null,
      privateKey: row.private_key, // Encrypted
      isDcaActive: row.is_dca_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Encrypt a private key for storage.
   */
  private async encryptPrivateKey(plainKey: string): Promise<string> {
    return this.encryptionService.encrypt(plainKey);
  }

  /**
   * Get user by Telegram ID.
   * Note: privateKey is returned ENCRYPTED for security.
   */
  async getById(id: TelegramId): Promise<User | undefined> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where("telegram_id", "=", id.value)
      .executeTakeFirst();

    if (!row) return undefined;

    return this.rowToModel(row);
  }

  async create(id: TelegramId): Promise<void> {
    await this.db
      .insertInto("users")
      .values({ telegram_id: id.value })
      .onConflict((oc) => oc.column("telegram_id").doNothing())
      .execute();
  }

  async setWalletAddress(id: TelegramId, address: WalletAddress): Promise<void> {
    await this.db
      .updateTable("users")
      .set({
        wallet_address: address.value,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where("telegram_id", "=", id.value)
      .execute();
  }

  async setWalletData(
    id: TelegramId,
    privateKey: string,
    address: WalletAddress,
  ): Promise<void> {
    const encryptedKey = await this.encryptPrivateKey(privateKey);

    await this.db.transaction().execute(async (trx) => {
      await trx
        .updateTable("users")
        .set({
          private_key: encryptedKey,
          wallet_address: address.value,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where("telegram_id", "=", id.value)
        .execute();
    });
  }

  async getAllWithWallet(): Promise<UserWithWallet[]> {
    const rows = await this.db
      .selectFrom("users")
      .select(["telegram_id", "wallet_address"])
      .where("wallet_address", "is not", null)
      .where("wallet_address", "!=", "")
      .execute();

    return rows.map((row) => ({
      telegramId: new TelegramId(row.telegram_id),
      walletAddress: new WalletAddress(row.wallet_address!),
    }));
  }

  async setPrivateKey(id: TelegramId, privateKey: string): Promise<void> {
    // Encrypt private key before storage
    const encryptedKey = await this.encryptPrivateKey(privateKey);

    await this.db
      .updateTable("users")
      .set({
        private_key: encryptedKey,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where("telegram_id", "=", id.value)
      .execute();
  }

  async clearPrivateKey(id: TelegramId): Promise<void> {
    await this.db
      .updateTable("users")
      .set({
        private_key: null,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where("telegram_id", "=", id.value)
      .execute();
  }

  async getDecryptedPrivateKey(id: TelegramId): Promise<string | null> {
    const row = await this.db
      .selectFrom("users")
      .select("private_key")
      .where("telegram_id", "=", id.value)
      .executeTakeFirst();

    if (!row?.private_key) {
      return null;
    }
    return this.encryptionService.decrypt(row.private_key);
  }

  /**
   * Get all users with DCA wallets.
   * Note: privateKey is returned ENCRYPTED for security.
   */
  async getAllWithDcaWallet(): Promise<UserWithDcaWallet[]> {
    const rows = await this.db
      .selectFrom("users")
      .select(["telegram_id", "private_key"])
      .where("private_key", "is not", null)
      .where("private_key", "!=", "")
      .execute();

    return rows.map((row) => ({
      telegramId: new TelegramId(row.telegram_id),
      privateKey: row.private_key!, // Encrypted
    }));
  }

  async setDcaActive(id: TelegramId, active: boolean): Promise<void> {
    await this.db
      .updateTable("users")
      .set({
        is_dca_active: active ? 1 : 0,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where("telegram_id", "=", id.value)
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
      telegramId: new TelegramId(row.telegram_id),
      walletAddress: new WalletAddress(row.wallet_address!),
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

  async delete(id: TelegramId): Promise<void> {
    await this.db
      .deleteFrom("users")
      .where("telegram_id", "=", id.value)
      .execute();
  }
}
