/**
 * Reset portfolio use case
 */

import { DcaService } from "../../services/dca.js";
import { ResetResult } from "./types.js";

export class ResetPortfolioUseCase {
  constructor(
    private dca: DcaService | undefined,
  ) {}

  async execute(telegramId: number): Promise<ResetResult> {
    if (!this.dca || !this.dca.isMockMode()) {
      return { type: "unavailable" };
    }

    await this.dca.resetPortfolio(telegramId);
    return { type: "success" };
  }
}
