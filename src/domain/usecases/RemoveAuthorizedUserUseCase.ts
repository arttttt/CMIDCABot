/**
 * RemoveAuthorizedUserUseCase - removes an authorized user
 */

import type { TelegramId } from "../models/id/index.js";
import type { OwnerConfig } from "../models/OwnerConfig.js";
import { UserIdentity } from "../models/UserIdentity.js";
import { AuthRepository } from "../repositories/AuthRepository.js";
import { ROLE_LABELS } from "../models/AuthorizedUser.js";
import { AuthorizationPolicy } from "../policies/AuthorizationPolicy.js";
import type { GetUserRoleUseCase } from "./GetUserRoleUseCase.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export type RemoveAuthorizedUserResult =
  | { success: true; message: string }
  | { success: false; error: string };

export class RemoveAuthorizedUserUseCase {
  constructor(
    private authRepository: AuthRepository,
    private getUserRole: GetUserRoleUseCase,
    private ownerConfig: OwnerConfig,
  ) {}

  async execute(
    adminTelegramId: TelegramId,
    targetTelegramId: TelegramId,
  ): Promise<RemoveAuthorizedUserResult> {
    logger.info("RemoveAuthorizedUser", "Removing user", {
      admin: adminTelegramId,
      target: targetTelegramId,
    });

    // Cannot remove owner
    if (targetTelegramId.equals(this.ownerConfig.telegramId)) {
      return { success: false, error: "Cannot remove owner" };
    }

    // Check admin permissions before touching the target
    // (do not reveal user existence to unauthorized callers)
    const adminRole = await this.getUserRole.execute(UserIdentity.telegram(adminTelegramId));
    const denied = AuthorizationPolicy.checkAdminAccess(adminRole);
    if (denied) {
      return { success: false, error: denied };
    }

    // Get target user
    const target = await this.authRepository.getById(targetTelegramId);
    if (!target) {
      return { success: false, error: `User ${targetTelegramId} is not authorized` };
    }

    if (!AuthorizationPolicy.canManageRole(adminRole, target.role)) {
      return { success: false, error: `Cannot manage ${ROLE_LABELS[target.role]} users` };
    }

    // Remove user authorization
    const removed = await this.authRepository.remove(targetTelegramId);
    if (!removed) {
      return { success: false, error: "Failed to remove user" };
    }

    logger.info("RemoveAuthorizedUser", "User removed", {
      admin: adminTelegramId,
      target: targetTelegramId,
    });

    return { success: true, message: `User ${targetTelegramId} removed` };
  }
}
