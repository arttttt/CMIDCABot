/**
 * Purchase repository interface
 */
import { Purchase, CreatePurchaseData } from "../models/Purchase.js";

export interface PurchaseRepository {
  /**
   * Get all purchases for a user
   */
  getByUserId(telegramId: number): Promise<Purchase[]>;

  /**
   * Create a new purchase
   */
  create(data: CreatePurchaseData): Promise<Purchase>;

  /**
   * Delete all purchases for a user
   */
  deleteByUserId(telegramId: number): Promise<void>;
}
