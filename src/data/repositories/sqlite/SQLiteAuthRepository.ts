/**
 * SQLite implementation of Auth repository using Kysely
 */
import { Kysely, sql, Selectable } from "kysely";
import { AuthRepository } from "../../../domain/repositories/AuthRepository.js";
import { AuthorizedUser, UserRole } from "../../../domain/models/AuthorizedUser.js";
import type { AuthDatabase, AuthorizedUsersTable } from "../../types/authDatabase.js";

type AuthUserRow = Selectable<AuthorizedUsersTable>;

export class SQLiteAuthRepository implements AuthRepository {
  constructor(private db: Kysely<AuthDatabase>) {}

  /**
   * Convert database row to domain model
   */
  private rowToModel(row: AuthUserRow): AuthorizedUser {
    return {
      telegramId: row.telegram_id,
      role: row.role as UserRole,
      addedBy: row.added_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async getById(telegramId: number): Promise<AuthorizedUser | undefined> {
    const row = await this.db
      .selectFrom("authorized_users")
      .selectAll()
      .where("telegram_id", "=", telegramId)
      .executeTakeFirst();

    if (!row) return undefined;
    return this.rowToModel(row);
  }

  async getAll(): Promise<AuthorizedUser[]> {
    const rows = await this.db
      .selectFrom("authorized_users")
      .selectAll()
      .orderBy("created_at", "asc")
      .execute();

    return rows.map((row) => this.rowToModel(row));
  }

  async getByRole(role: UserRole): Promise<AuthorizedUser[]> {
    const rows = await this.db
      .selectFrom("authorized_users")
      .selectAll()
      .where("role", "=", role)
      .orderBy("created_at", "asc")
      .execute();

    return rows.map((row) => this.rowToModel(row));
  }

  async add(telegramId: number, role: UserRole, addedBy: number | null): Promise<void> {
    await this.db
      .insertInto("authorized_users")
      .values({
        telegram_id: telegramId,
        role,
        added_by: addedBy,
      })
      .onConflict((oc) => oc.column("telegram_id").doNothing())
      .execute();
  }

  async remove(telegramId: number): Promise<boolean> {
    const result = await this.db
      .deleteFrom("authorized_users")
      .where("telegram_id", "=", telegramId)
      .executeTakeFirst();

    return result.numDeletedRows > 0;
  }

  async updateRole(telegramId: number, newRole: UserRole): Promise<boolean> {
    const result = await this.db
      .updateTable("authorized_users")
      .set({
        role: newRole,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where("telegram_id", "=", telegramId)
      .executeTakeFirst();

    return result.numUpdatedRows > 0;
  }

  async isAuthorized(telegramId: number): Promise<boolean> {
    const row = await this.db
      .selectFrom("authorized_users")
      .select("telegram_id")
      .where("telegram_id", "=", telegramId)
      .executeTakeFirst();

    return row !== undefined;
  }

  async count(): Promise<number> {
    const result = await this.db
      .selectFrom("authorized_users")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .executeTakeFirst();

    return result?.count ?? 0;
  }
}
