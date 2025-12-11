/**
 * In-memory implementation of Portfolio repository
 */
import { PortfolioRepository } from "../../../domain/repositories/PortfolioRepository.js";
import { PortfolioBalances } from "../../../domain/models/Portfolio.js";
import { AssetSymbol } from "../../../types/portfolio.js";

interface PortfolioData extends PortfolioBalances {
  createdAt: Date;
  updatedAt: Date;
}

export class InMemoryPortfolioRepository implements PortfolioRepository {
  private portfolios = new Map<number, PortfolioData>();

  async getById(telegramId: number): Promise<PortfolioBalances | undefined> {
    const portfolio = this.portfolios.get(telegramId);
    if (!portfolio) return undefined;

    return {
      telegramId: portfolio.telegramId,
      btcBalance: portfolio.btcBalance,
      ethBalance: portfolio.ethBalance,
      solBalance: portfolio.solBalance,
    };
  }

  async create(telegramId: number): Promise<void> {
    if (this.portfolios.has(telegramId)) {
      return;
    }

    const now = new Date();
    this.portfolios.set(telegramId, {
      telegramId,
      btcBalance: 0,
      ethBalance: 0,
      solBalance: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateBalance(telegramId: number, asset: AssetSymbol, amountToAdd: number): Promise<void> {
    const portfolio = this.portfolios.get(telegramId);
    if (!portfolio) return;

    switch (asset) {
      case "BTC":
        portfolio.btcBalance += amountToAdd;
        break;
      case "ETH":
        portfolio.ethBalance += amountToAdd;
        break;
      case "SOL":
        portfolio.solBalance += amountToAdd;
        break;
    }
    portfolio.updatedAt = new Date();
  }

  async reset(telegramId: number): Promise<void> {
    const portfolio = this.portfolios.get(telegramId);
    if (portfolio) {
      portfolio.btcBalance = 0;
      portfolio.ethBalance = 0;
      portfolio.solBalance = 0;
      portfolio.updatedAt = new Date();
    }
  }
}
