/**
 * Portfolio use cases - domain operations for portfolio management
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { DcaService } from "../../services/dca.js";
import { PortfolioStatusResult, ResetResult } from "./types.js";

export class PortfolioUseCases {
  constructor(
    private userRepository: UserRepository,
    private dca: DcaService | undefined,
  ) {}

  /**
   * Get portfolio status
   */
  async getStatus(telegramId: number): Promise<PortfolioStatusResult> {
    if (!this.dca || !this.dca.isMockMode()) {
      return { type: "unavailable" };
    }

    await this.userRepository.create(telegramId);
    await this.dca.createPortfolio(telegramId);

    const status = await this.dca.getPortfolioStatus(telegramId);

    if (!status) {
      return { type: "not_found" };
    }

    if (status.totalValueInUsdc === 0) {
      return { type: "empty" };
    }

    return { type: "success", status };
  }

  /**
   * Reset portfolio
   */
  async reset(telegramId: number): Promise<ResetResult> {
    if (!this.dca || !this.dca.isMockMode()) {
      return { type: "unavailable" };
    }

    await this.dca.resetPortfolio(telegramId);
    return { type: "success" };
  }
}
