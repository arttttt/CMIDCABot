/**
 * In-memory implementation of Transaction repository
 */
import { TransactionRepository } from "../../../domain/repositories/TransactionRepository.js";
import { Transaction, CreateTransactionData } from "../../../domain/models/Transaction.js";

export class InMemoryTransactionRepository implements TransactionRepository {
  private transactions = new Map<number, Transaction>();
  private nextId = 1;

  async getById(id: number): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async getByUserId(telegramId: number): Promise<Transaction[]> {
    const result: Transaction[] = [];
    for (const tx of this.transactions.values()) {
      if (tx.telegramId === telegramId) {
        result.push(tx);
      }
    }
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async create(data: CreateTransactionData): Promise<Transaction> {
    const id = this.nextId++;
    const transaction: Transaction = {
      id,
      telegramId: data.telegramId,
      txSignature: data.txSignature,
      assetSymbol: data.assetSymbol,
      amountSol: data.amountSol,
      amountAsset: data.amountAsset,
      createdAt: new Date(),
    };
    this.transactions.set(id, transaction);
    return transaction;
  }
}
