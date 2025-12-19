/**
 * Transaction repository interface
 */
import { Transaction, CreateTransactionData } from "../models/Transaction.js";

export interface TransactionRepository {
  /**
   * Get transaction by ID
   */
  getById(id: number): Promise<Transaction | undefined>;

  /**
   * Get all transactions for a user
   */
  getByUserId(telegramId: number): Promise<Transaction[]>;

  /**
   * Create a new transaction
   */
  create(data: CreateTransactionData): Promise<Transaction>;

  /**
   * Delete all transactions for a user
   */
  deleteByUserId(telegramId: number): Promise<void>;
}
