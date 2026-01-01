/**
 * GetUserRoleUseCase - transport-agnostic user role resolution
 *
 * Determines user role based on UserIdentity.
 * Returns "guest" for unknown users (never undefined).
 */

import type { TelegramId } from "../../types/id/index.js";
import type { AuthRepository } from "../repositories/AuthRepository.js";
import type { UserIdentity } from "../models/UserIdentity.js";
import type { UserRole } from "../models/AuthorizedUser.js";

export class GetUserRoleUseCase {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly ownerTelegramId: TelegramId,
  ) {}

  async execute(identity: UserIdentity): Promise<UserRole> {
    if (identity.provider === "telegram") {
      // Owner is always "owner" role
      if (identity.telegramId === this.ownerTelegramId) {
        return "owner";
      }

      const user = await this.authRepository.getById(identity.telegramId);
      return user?.role ?? "guest";
    }

    // HTTP identity — future implementation
    // For now, return "guest" (no authorization)
    return "guest";
  }
}
