/**
 * Purchase domain model
 */
import { AssetSymbol } from "../../types/portfolio.js";

export interface Purchase {
  id: number;
  telegramId: number;
  assetSymbol: AssetSymbol;
  amountUsdc: number;
  amountAsset: number;
  priceUsd: number;
  createdAt: Date;
}

export interface CreatePurchaseData {
  telegramId: number;
  assetSymbol: AssetSymbol;
  amountUsdc: number;
  amountAsset: number;
  priceUsd: number;
}
