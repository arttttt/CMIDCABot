/**
 * Purchase domain model
 */
import { AssetSymbol } from "../../types/portfolio.js";
import type { TelegramId } from "../../types/id/index.js";

export interface Purchase {
  id: number;
  telegramId: TelegramId;
  assetSymbol: AssetSymbol;
  amountUsdc: number;
  amountAsset: number;
  priceUsd: number;
  createdAt: Date;
}

export interface CreatePurchaseData {
  telegramId: TelegramId;
  assetSymbol: AssetSymbol;
  amountUsdc: number;
  amountAsset: number;
  priceUsd: number;
}
