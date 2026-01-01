/**
 * SQLite implementation of Portfolio repository using Kysely (for mock/development mode)
 */
import { Kysely, sql, Selectable } from "kysely";
import { PortfolioRepository } from "../../../domain/repositories/PortfolioRepository.js";
import { PortfolioBalances } from "../../../domain/models/Portfolio.js";
import { telegramId, type TelegramId } from "../../../domain/models/id/index.js";
import { AssetSymbol } from "../../../types/portfolio.js";
import type { MockDatabase, PortfolioTable } from "../../types/database.js";

type PortfolioRow = Selectable<PortfolioTable>;

export class SQLitePortfolioRepository implements PortfolioRepository {
  constructor(private db: Kysely<MockDatabase>) {}

  private rowToModel(row: PortfolioRow): PortfolioBalances {
    return {
      telegramId: telegramId(row.telegram_id),
      btcBalance: row.btc_balance,
      ethBalance: row.eth_balance,
      solBalance: row.sol_balance,
    };
  }

  async getById(id: TelegramId): Promise<PortfolioBalances | undefined> {
    const row = await this.db
      .selectFrom("portfolio")
      .selectAll()
      .where("telegram_id", "=", id as number)
      .executeTakeFirst();

    if (!row) return undefined;

    return this.rowToModel(row);
  }

  async create(id: TelegramId): Promise<void> {
    await this.db
      .insertInto("portfolio")
      .values({ telegram_id: id as number })
      .onConflict((oc) => oc.column("telegram_id").doNothing())
      .execute();
  }

  async updateBalance(id: TelegramId, asset: AssetSymbol, amountToAdd: number): Promise<void> {
    const column = `${asset.toLowerCase()}_balance` as "btc_balance" | "eth_balance" | "sol_balance";
    const idNum = id as number;

    // Use raw SQL for the increment operation
    await sql`
      UPDATE portfolio
      SET ${sql.ref(column)} = ${sql.ref(column)} + ${amountToAdd},
          updated_at = CURRENT_TIMESTAMP
      WHERE telegram_id = ${idNum}
    `.execute(this.db);
  }

  async reset(id: TelegramId): Promise<void> {
    await this.db
      .updateTable("portfolio")
      .set({
        btc_balance: 0,
        eth_balance: 0,
        sol_balance: 0,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where("telegram_id", "=", id as number)
      .execute();
  }

  async deleteByUserId(id: TelegramId): Promise<void> {
    await this.db
      .deleteFrom("portfolio")
      .where("telegram_id", "=", id as number)
      .execute();
  }
}
