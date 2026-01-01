/**
 * Portfolio repository interface (for mock/development mode)
 */
import type { TelegramId } from "../../types/id/index.js";
import { PortfolioBalances } from "../models/Portfolio.js";
import { AssetSymbol } from "../../types/portfolio.js";

export interface PortfolioRepository {
  /**
   * Get portfolio by Telegram ID
   */
  getById(telegramId: TelegramId): Promise<PortfolioBalances | undefined>;

  /**
   * Create a new portfolio (or ignore if exists)
   */
  create(telegramId: TelegramId): Promise<void>;

  /**
   * Update portfolio balance for a specific asset
   */
  updateBalance(telegramId: TelegramId, asset: AssetSymbol, amountToAdd: number): Promise<void>;

  /**
   * Reset portfolio to zero balances and clear purchase history
   */
  reset(telegramId: TelegramId): Promise<void>;

  /**
   * Delete portfolio for a user
   */
  deleteByUserId(telegramId: TelegramId): Promise<void>;
}
