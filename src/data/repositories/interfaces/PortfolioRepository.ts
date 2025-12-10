/**
 * Portfolio repository interface (for mock/development mode)
 */
import { PortfolioBalances } from "../../../domain/models/Portfolio.js";
import { AssetSymbol } from "../../../types/portfolio.js";

export interface PortfolioRepository {
  /**
   * Get portfolio by Telegram ID
   */
  getById(telegramId: number): PortfolioBalances | undefined;

  /**
   * Create a new portfolio (or ignore if exists)
   */
  create(telegramId: number): void;

  /**
   * Update portfolio balance for a specific asset
   */
  updateBalance(telegramId: number, asset: AssetSymbol, amountToAdd: number): void;

  /**
   * Reset portfolio to zero balances and clear purchase history
   */
  reset(telegramId: number): void;
}
