/**
 * SQLite implementation of InviteToken repository using Kysely
 */
import { Kysely, sql, Selectable } from "kysely";
import { InviteTokenRepository } from "../../../domain/repositories/InviteTokenRepository.js";
import { InviteToken } from "../../../domain/models/InviteToken.js";
import { UserRole } from "../../../domain/models/AuthorizedUser.js";
import { telegramId, type TelegramId } from "../../../domain/models/id/index.js";
import type { AuthDatabase, InviteTokensTable } from "../../types/authDatabase.js";

type InviteTokenRow = Selectable<InviteTokensTable>;

export class SQLiteInviteTokenRepository implements InviteTokenRepository {
  constructor(private db: Kysely<AuthDatabase>) {}

  /**
   * Convert database row to domain model
   */
  private rowToModel(row: InviteTokenRow): InviteToken {
    return {
      token: row.token,
      role: row.role as UserRole,
      createdBy: telegramId(row.created_by),
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      usedBy: row.used_by ? telegramId(row.used_by) : null,
      usedAt: row.used_at ? new Date(row.used_at) : null,
    };
  }

  async create(token: string, role: UserRole, createdBy: TelegramId, expiresAt: Date): Promise<void> {
    await this.db
      .insertInto("invite_tokens")
      .values({
        token,
        role,
        created_by: createdBy as number,
        expires_at: expiresAt.toISOString(),
      })
      .execute();
  }

  async getByToken(token: string): Promise<InviteToken | undefined> {
    const row = await this.db
      .selectFrom("invite_tokens")
      .selectAll()
      .where("token", "=", token)
      .executeTakeFirst();

    if (!row) return undefined;
    return this.rowToModel(row);
  }

  async markUsed(token: string, usedBy: TelegramId): Promise<boolean> {
    const result = await this.db
      .updateTable("invite_tokens")
      .set({
        used_by: usedBy as number,
        used_at: sql`CURRENT_TIMESTAMP`,
      })
      .where("token", "=", token)
      .where("used_by", "is", null)
      .executeTakeFirst();

    return result.numUpdatedRows > 0;
  }

  async deleteExpired(): Promise<number> {
    const result = await this.db
      .deleteFrom("invite_tokens")
      .where("expires_at", "<", new Date().toISOString())
      .where("used_by", "is", null)
      .executeTakeFirst();

    return Number(result.numDeletedRows);
  }

  async getByCreator(createdBy: TelegramId): Promise<InviteToken[]> {
    const rows = await this.db
      .selectFrom("invite_tokens")
      .selectAll()
      .where("created_by", "=", createdBy as number)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map((row) => this.rowToModel(row));
  }
}
