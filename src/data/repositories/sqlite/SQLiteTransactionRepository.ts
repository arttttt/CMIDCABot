/**
 * SQLite implementation of Transaction repository using Kysely
 */
import { Kysely, Selectable } from "kysely";
import { TransactionRepository } from "../../../domain/repositories/TransactionRepository.js";
import { Transaction, CreateTransactionData } from "../../../domain/models/Transaction.js";
import { telegramId, txSignature, type TelegramId } from "../../../types/id/index.js";
import { AssetSymbol } from "../../../types/portfolio.js";
import type { MainDatabase, TransactionsTable } from "../../types/database.js";

type TransactionRow = Selectable<TransactionsTable>;

export class SQLiteTransactionRepository implements TransactionRepository {
  constructor(private db: Kysely<MainDatabase>) {}

  private rowToModel(row: TransactionRow): Transaction {
    return {
      id: row.id,
      telegramId: telegramId(row.telegram_id),
      txSignature: txSignature(row.tx_signature),
      assetSymbol: row.asset_symbol as AssetSymbol,
      amountUsdc: row.amount_usdc,
      amountAsset: row.amount_asset,
      createdAt: new Date(row.created_at),
    };
  }

  async getById(id: number): Promise<Transaction | undefined> {
    const row = await this.db
      .selectFrom("transactions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!row) return undefined;

    return this.rowToModel(row);
  }

  async getByUserId(id: TelegramId): Promise<Transaction[]> {
    const rows = await this.db
      .selectFrom("transactions")
      .selectAll()
      .where("telegram_id", "=", id as number)
      .orderBy("created_at", "desc")
      .execute();

    return rows.map((row) => this.rowToModel(row));
  }

  async create(data: CreateTransactionData): Promise<Transaction> {
    const row = await this.db
      .insertInto("transactions")
      .values({
        telegram_id: data.telegramId as number,
        tx_signature: data.txSignature as string,
        asset_symbol: data.assetSymbol,
        amount_usdc: data.amountUsdc,
        amount_asset: data.amountAsset,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return this.rowToModel(row);
  }

  async deleteByUserId(id: TelegramId): Promise<void> {
    await this.db
      .deleteFrom("transactions")
      .where("telegram_id", "=", id as number)
      .execute();
  }
}
