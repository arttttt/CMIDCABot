/**
 * Transaction domain model
 */
import { AssetSymbol } from "../../types/portfolio.js";
import type { TelegramId, TxSignature } from "../../types/id/index.js";

export interface Transaction {
  id: number;
  telegramId: TelegramId;
  txSignature: TxSignature;
  assetSymbol: AssetSymbol;
  amountUsdc: number;
  amountAsset: number;
  createdAt: Date;
}

export interface CreateTransactionData {
  telegramId: TelegramId;
  txSignature: TxSignature;
  assetSymbol: AssetSymbol;
  amountUsdc: number;
  amountAsset: number;
}
