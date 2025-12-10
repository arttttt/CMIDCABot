/**
 * MockPurchase domain model (for development mode)
 */
import { AssetSymbol } from "../../types/portfolio.js";

export interface MockPurchase {
  id: number;
  telegramId: number;
  assetSymbol: AssetSymbol;
  amountSol: number;
  amountAsset: number;
  priceUsd: number;
  createdAt: Date;
}

export interface CreateMockPurchaseData {
  telegramId: number;
  assetSymbol: AssetSymbol;
  amountSol: number;
  amountAsset: number;
  priceUsd: number;
}
