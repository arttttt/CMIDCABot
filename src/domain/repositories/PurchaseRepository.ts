/**
 * Purchase repository interface
 */
import type { TelegramId } from "../models/id/index.js";
import { Purchase, CreatePurchaseData } from "../models/Purchase.js";

export interface PurchaseRepository {
  /**
   * Get all purchases for a user
   */
  getByUserId(telegramId: TelegramId): Promise<Purchase[]>;

  /**
   * Create a new purchase
   */
  create(data: CreatePurchaseData): Promise<Purchase>;

  /**
   * Delete all purchases for a user
   */
  deleteByUserId(telegramId: TelegramId): Promise<void>;
}
