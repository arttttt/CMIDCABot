/**
 * RemoveAuthorizedUserUseCase - removes an authorized user
 */

import type { TelegramId } from "../models/id/index.js";
import { AuthRepository } from "../repositories/AuthRepository.js";
import { canManageRole, isAdminRole, ROLE_LABELS } from "../models/AuthorizedUser.js";
import { AuthorizationHelper } from "../helpers/AuthorizationHelper.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export type RemoveAuthorizedUserResult =
  | { success: true; message: string }
  | { success: false; error: string };

export class RemoveAuthorizedUserUseCase {
  constructor(
    private authRepository: AuthRepository,
    private authHelper: AuthorizationHelper,
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
    if (targetTelegramId === this.authHelper.getOwnerTelegramId()) {
      return { success: false, error: "Cannot remove owner" };
    }

    // Get target user
    const target = await this.authRepository.getById(targetTelegramId);
    if (!target) {
      return { success: false, error: `User ${targetTelegramId} is not authorized` };
    }

    // Check admin permissions
    const adminRole = await this.authHelper.getRole(adminTelegramId);
    if (!adminRole) {
      return { success: false, error: "Not authorized" };
    }

    if (!isAdminRole(adminRole)) {
      return { success: false, error: "Admin privileges required" };
    }

    if (!canManageRole(adminRole, target.role)) {
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
