/**
 * MockPurchase repository interface (for development mode)
 */
import { MockPurchase, CreateMockPurchaseData } from "../models/MockPurchase.js";

export interface MockPurchaseRepository {
  /**
   * Get all mock purchases for a user
   */
  getByUserId(telegramId: number): Promise<MockPurchase[]>;

  /**
   * Create a new mock purchase
   */
  create(data: CreateMockPurchaseData): Promise<MockPurchase>;

  /**
   * Delete all mock purchases for a user
   */
  deleteByUserId(telegramId: number): Promise<void>;
}
