/**
 * SQLite implementation of Portfolio repository using Kysely (for mock/development mode)
 */
import { Kysely, sql } from "kysely";
import { PortfolioRepository } from "../../../domain/repositories/PortfolioRepository.js";
import { PortfolioBalances } from "../../../domain/models/Portfolio.js";
import { AssetSymbol } from "../../../types/portfolio.js";
import type { MockDatabase } from "../../types/database.js";

interface PortfolioRow {
  telegram_id: number;
  btc_balance: number;
  eth_balance: number;
  sol_balance: number;
  created_at: string;
  updated_at: string;
}

export class SQLitePortfolioRepository implements PortfolioRepository {
  constructor(private db: Kysely<MockDatabase>) {}

  private rowToModel(row: PortfolioRow): PortfolioBalances {
    return {
      telegramId: row.telegram_id,
      btcBalance: row.btc_balance,
      ethBalance: row.eth_balance,
      solBalance: row.sol_balance,
    };
  }

  getById(telegramId: number): PortfolioBalances | undefined {
    const row = this.db
      .selectFrom("portfolio")
      .selectAll()
      .where("telegram_id", "=", telegramId)
      .executeTakeFirst();

    const result = row as unknown as PortfolioRow | undefined;
    if (!result) return undefined;

    return this.rowToModel(result);
  }

  create(telegramId: number): void {
    this.db
      .insertInto("portfolio")
      .values({ telegram_id: telegramId })
      .onConflict((oc) => oc.column("telegram_id").doNothing())
      .execute();
  }

  updateBalance(telegramId: number, asset: AssetSymbol, amountToAdd: number): void {
    const column = `${asset.toLowerCase()}_balance` as "btc_balance" | "eth_balance" | "sol_balance";

    // Use raw SQL for the increment operation
    sql`
      UPDATE portfolio
      SET ${sql.ref(column)} = ${sql.ref(column)} + ${amountToAdd},
          updated_at = CURRENT_TIMESTAMP
      WHERE telegram_id = ${telegramId}
    `.execute(this.db);
  }

  reset(telegramId: number): void {
    this.db
      .updateTable("portfolio")
      .set({
        btc_balance: 0,
        eth_balance: 0,
        sol_balance: 0,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where("telegram_id", "=", telegramId)
      .execute();
  }
}
