/**
 * Transaction domain model
 */
import { AssetSymbol } from "../../types/portfolio.js";

export interface Transaction {
  id: number;
  telegramId: number;
  txSignature: string;
  assetSymbol: AssetSymbol;
  amountSol: number;
  amountAsset: number;
  createdAt: Date;
}

export interface CreateTransactionData {
  telegramId: number;
  txSignature: string;
  assetSymbol: AssetSymbol;
  amountSol: number;
  amountAsset: number;
}
