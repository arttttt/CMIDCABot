/**
 * Portfolio domain model (for mock/development mode)
 */
export interface Portfolio {
  telegramId: number;
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
  telegramId: number;
  btcBalance: number;
  ethBalance: number;
  solBalance: number;
}
