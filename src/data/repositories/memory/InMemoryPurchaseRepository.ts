/**
 * In-memory implementation of Purchase repository
 */
import { PurchaseRepository } from "../../../domain/repositories/PurchaseRepository.js";
import { Purchase, CreatePurchaseData } from "../../../domain/models/Purchase.js";

export class InMemoryPurchaseRepository implements PurchaseRepository {
  private purchases = new Map<number, Purchase>();
  private nextId = 1;

  async getByUserId(telegramId: number): Promise<Purchase[]> {
    const result: Purchase[] = [];
    for (const purchase of this.purchases.values()) {
      if (purchase.telegramId === telegramId) {
        result.push(purchase);
      }
    }
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async create(data: CreatePurchaseData): Promise<Purchase> {
    const id = this.nextId++;
    const purchase: Purchase = {
      id,
      telegramId: data.telegramId,
      assetSymbol: data.assetSymbol,
      amountSol: data.amountSol,
      amountAsset: data.amountAsset,
      priceUsd: data.priceUsd,
      createdAt: new Date(),
    };
    this.purchases.set(id, purchase);
    return purchase;
  }

  async deleteByUserId(telegramId: number): Promise<void> {
    for (const [id, purchase] of this.purchases.entries()) {
      if (purchase.telegramId === telegramId) {
        this.purchases.delete(id);
      }
    }
  }
}
