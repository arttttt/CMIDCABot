/**
 * Transaction domain model
 */
import { AssetSymbol } from "../constants/portfolio.js";
import type { TelegramId, TransactionId, TxSignature } from "./id/index.js";

export interface Transaction {
  id: TransactionId;
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
