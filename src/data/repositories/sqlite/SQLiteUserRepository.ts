/**
 * SQLite implementation of User repository using Kysely
 */
import { Kysely, sql } from "kysely";
import { UserRepository } from "../../../domain/repositories/UserRepository.js";
import { User, UserWithWallet } from "../../../domain/models/User.js";
import type { MainDatabase } from "../../types/database.js";

export class SQLiteUserRepository implements UserRepository {
  constructor(private db: Kysely<MainDatabase>) {}

  getById(telegramId: number): User | undefined {
    const row = this.db
      .selectFrom("users")
      .selectAll()
      .where("telegram_id", "=", telegramId)
      .executeTakeFirst();

    // Kysely with better-sqlite3 is synchronous
    const result = row as unknown as {
      telegram_id: number;
      wallet_address: string | null;
      created_at: string;
      updated_at: string;
    } | undefined;

    if (!result) return undefined;

    return {
      telegramId: result.telegram_id,
      walletAddress: result.wallet_address,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    };
  }

  create(telegramId: number): void {
    this.db
      .insertInto("users")
      .values({ telegram_id: telegramId })
      .onConflict((oc) => oc.column("telegram_id").doNothing())
      .execute();
  }

  setWalletAddress(telegramId: number, walletAddress: string): void {
    this.db
      .updateTable("users")
      .set({
        wallet_address: walletAddress,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where("telegram_id", "=", telegramId)
      .execute();
  }

  getAllWithWallet(): UserWithWallet[] {
    const rows = this.db
      .selectFrom("users")
      .select(["telegram_id", "wallet_address"])
      .where("wallet_address", "is not", null)
      .where("wallet_address", "!=", "")
      .execute();

    // Kysely with better-sqlite3 is synchronous
    const results = rows as unknown as Array<{
      telegram_id: number;
      wallet_address: string;
    }>;

    return results.map((row) => ({
      telegramId: row.telegram_id,
      walletAddress: row.wallet_address,
    }));
  }
}
