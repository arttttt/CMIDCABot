/**
 * MockPurchase repository interface (for development mode)
 */
import { MockPurchase, CreateMockPurchaseData } from "../../../domain/models/MockPurchase.js";

export interface MockPurchaseRepository {
  /**
   * Get all mock purchases for a user
   */
  getByUserId(telegramId: number): MockPurchase[];

  /**
   * Create a new mock purchase
   */
  create(data: CreateMockPurchaseData): MockPurchase;

  /**
   * Delete all mock purchases for a user
   */
  deleteByUserId(telegramId: number): void;
}
