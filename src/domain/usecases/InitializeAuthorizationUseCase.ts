/**
 * InitializeAuthorizationUseCase - ensures owner is in the database
 *
 * This use case should be called during application startup.
 */

import type { TelegramId } from "../../types/id/index.js";
import { AuthRepository } from "../repositories/AuthRepository.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class InitializeAuthorizationUseCase {
  constructor(
    private authRepository: AuthRepository,
    private ownerTelegramId: TelegramId,
  ) {}

  async execute(): Promise<void> {
    const owner = await this.authRepository.getById(this.ownerTelegramId);
    if (!owner) {
      await this.authRepository.add(this.ownerTelegramId, "owner", null);
      logger.info("InitializeAuthorization", "Owner initialized", {
        telegramId: this.ownerTelegramId,
      });
    }
  }
}
