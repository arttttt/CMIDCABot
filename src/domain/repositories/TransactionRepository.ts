/**
 * Transaction repository interface
 */
import { Transaction, CreateTransactionData } from "../models/Transaction.js";

export interface TransactionRepository {
  /**
   * Get transaction by ID
   */
  getById(id: number): Transaction | undefined;

  /**
   * Get all transactions for a user
   */
  getByUserId(telegramId: number): Transaction[];

  /**
   * Create a new transaction
   */
  create(data: CreateTransactionData): Transaction;
}
