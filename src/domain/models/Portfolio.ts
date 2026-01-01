/**
 * Portfolio domain model (for mock/development mode)
 */
import type { TelegramId } from "./id/index.js";

export interface Portfolio {
  telegramId: TelegramId;
  btcBalance: number;
  ethBalance: number;
  solBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Simplified portfolio data for calculations
 */
export interface PortfolioBalances {
  telegramId: TelegramId;
  btcBalance: number;
  ethBalance: number;
  solBalance: number;
}
