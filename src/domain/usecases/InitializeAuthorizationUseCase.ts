/**
 * InitializeAuthorizationUseCase - ensures owner is in the database
 *
 * This use case should be called during application startup.
 */

import type { OwnerConfig } from "../../infrastructure/shared/config/index.js";
import { AuthRepository } from "../repositories/AuthRepository.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class InitializeAuthorizationUseCase {
  constructor(
    private authRepository: AuthRepository,
    private ownerConfig: OwnerConfig,
  ) {}

  async execute(): Promise<void> {
    const owner = await this.authRepository.getById(this.ownerConfig.telegramId);
    if (!owner) {
      await this.authRepository.add(this.ownerConfig.telegramId, "owner", null);
      logger.info("InitializeAuthorization", "Owner initialized", {
        telegramId: this.ownerConfig.telegramId,
      });
    }
  }
}
