/**
 * Init user use case
 */

import type { TelegramId } from "../models/id/index.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { PortfolioRepository } from "../repositories/PortfolioRepository.js";
import { InitUserResult } from "./types.js";

export class InitUserUseCase {
  constructor(
    private userRepository: UserRepository,
    private portfolioRepository?: PortfolioRepository,
  ) {}

  async execute(telegramId: TelegramId): Promise<InitUserResult> {
    await this.userRepository.create(telegramId);
    // Create portfolio in dev mode if repository available
    await this.portfolioRepository?.create(telegramId);
    return { type: "success" };
  }
}
