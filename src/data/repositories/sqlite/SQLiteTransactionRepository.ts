/**
 * SQLite implementation of Transaction repository using Kysely
 */
import { Kysely } from "kysely";
import { TransactionRepository } from "../../../domain/repositories/TransactionRepository.js";
import { Transaction, CreateTransactionData } from "../../../domain/models/Transaction.js";
import { AssetSymbol } from "../../../types/portfolio.js";
import type { MainDatabase } from "../../types/database.js";

interface TransactionRow {
  id: number;
  telegram_id: number;
  tx_signature: string;
  asset_symbol: string;
  amount_sol: number;
  amount_asset: number;
  created_at: string;
}

export class SQLiteTransactionRepository implements TransactionRepository {
  constructor(private db: Kysely<MainDatabase>) {}

  private rowToModel(row: TransactionRow): Transaction {
    return {
      id: row.id,
      telegramId: row.telegram_id,
      txSignature: row.tx_signature,
      assetSymbol: row.asset_symbol as AssetSymbol,
      amountSol: row.amount_sol,
      amountAsset: row.amount_asset,
      createdAt: new Date(row.created_at),
    };
  }

  getById(id: number): Transaction | undefined {
    const row = this.db
      .selectFrom("transactions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    const result = row as unknown as TransactionRow | undefined;
    if (!result) return undefined;

    return this.rowToModel(result);
  }

  getByUserId(telegramId: number): Transaction[] {
    const rows = this.db
      .selectFrom("transactions")
      .selectAll()
      .where("telegram_id", "=", telegramId)
      .orderBy("created_at", "desc")
      .execute();

    const results = rows as unknown as TransactionRow[];
    return results.map((row) => this.rowToModel(row));
  }

  create(data: CreateTransactionData): Transaction {
    const result = this.db
      .insertInto("transactions")
      .values({
        telegram_id: data.telegramId,
        tx_signature: data.txSignature,
        asset_symbol: data.assetSymbol,
        amount_sol: data.amountSol,
        amount_asset: data.amountAsset,
      })
      .returning(["id", "telegram_id", "tx_signature", "asset_symbol", "amount_sol", "amount_asset", "created_at"])
      .executeTakeFirst();

    const row = result as unknown as TransactionRow;
    return this.rowToModel(row);
  }
}
