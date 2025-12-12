/**
 * Get portfolio status use case
 */

import { UserRepository } from "../repositories/UserRepository.js";
import { DcaService } from "../../services/dca.js";
import { PortfolioStatusResult } from "./types.js";

export class GetPortfolioStatusUseCase {
  constructor(
    private userRepository: UserRepository,
    private dca: DcaService | undefined,
  ) {}

  async execute(telegramId: number): Promise<PortfolioStatusResult> {
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
}
