/**
 * SQLite implementation of User repository using Kysely
 */
import { Kysely, sql, Selectable } from "kysely";
import { UserRepository } from "../../../domain/repositories/UserRepository.js";
import { User, UserWithWallet, UserWithDcaWallet, ActiveDcaUser } from "../../../domain/models/User.js";
import type { MainDatabase, UsersTable } from "../../types/database.js";

type UserRow = Selectable<UsersTable>;

export class SQLiteUserRepository implements UserRepository {
  constructor(private db: Kysely<MainDatabase>) {}

  private rowToModel(row: UserRow): User {
    return {
      telegramId: row.telegram_id,
      walletAddress: row.wallet_address,
      privateKey: row.private_key,
      isDcaActive: row.is_dca_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async getById(telegramId: number): Promise<User | undefined> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where("telegram_id", "=", telegramId)
      .executeTakeFirst();

    if (!row) return undefined;

    return this.rowToModel(row);
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
    await this.db
      .updateTable("users")
      .set({
        private_key: privateKey,
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

    return rows.map((row) => ({
      telegramId: row.telegram_id,
      privateKey: row.private_key!,
    }));
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

  async getActiveDcaCount(): Promise<number> {
    const result = await this.db
      .selectFrom("users")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("wallet_address", "is not", null)
      .where("wallet_address", "!=", "")
      .where("is_dca_active", "=", 1)
      .executeTakeFirst();

    return result?.count ?? 0;
  }
}
