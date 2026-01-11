/**
 * UpdateUserRoleUseCase - updates a user's role
 */

import type { TelegramId } from "../models/id/index.js";
import type { OwnerConfig } from "../../infrastructure/shared/config/index.js";
import { UserIdentity } from "../models/UserIdentity.js";
import { AuthRepository } from "../repositories/AuthRepository.js";
import { UserRole, canManageRole, isAdminRole, ROLE_LABELS } from "../models/AuthorizedUser.js";
import type { GetUserRoleUseCase } from "./GetUserRoleUseCase.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export type UpdateUserRoleResult =
  | { success: true; message: string }
  | { success: false; error: string };

export class UpdateUserRoleUseCase {
  constructor(
    private authRepository: AuthRepository,
    private getUserRole: GetUserRoleUseCase,
    private ownerConfig: OwnerConfig,
  ) {}

  async execute(
    adminTelegramId: TelegramId,
    targetTelegramId: TelegramId,
    newRole: UserRole,
  ): Promise<UpdateUserRoleResult> {
    logger.info("UpdateUserRole", "Updating role", {
      admin: adminTelegramId,
      target: targetTelegramId,
      newRole,
    });

    // Cannot change owner
    if (targetTelegramId.equals(this.ownerConfig.telegramId)) {
      return { success: false, error: "Cannot change owner's role" };
    }

    // Cannot assign owner role
    if (newRole === "owner") {
      return { success: false, error: "Cannot assign owner role" };
    }

    // Get target user
    const target = await this.authRepository.getById(targetTelegramId);
    if (!target) {
      return { success: false, error: `User ${targetTelegramId} is not authorized` };
    }

    // Check admin permissions
    const adminRole = await this.getUserRole.execute(UserIdentity.telegram(adminTelegramId));
    if (adminRole === "guest") {
      return { success: false, error: "Admin not found" };
    }

    if (!isAdminRole(adminRole)) {
      return { success: false, error: "Admin privileges required" };
    }

    if (!canManageRole(adminRole, target.role)) {
      return { success: false, error: `Cannot modify ${ROLE_LABELS[target.role]} users` };
    }

    if (!canManageRole(adminRole, newRole)) {
      return { success: false, error: `Cannot assign ${ROLE_LABELS[newRole]} role` };
    }

    // Update role
    const updated = await this.authRepository.updateRole(targetTelegramId, newRole);
    if (!updated) {
      return { success: false, error: "Failed to update role" };
    }

    logger.info("UpdateUserRole", "Role updated", {
      admin: adminTelegramId,
      target: targetTelegramId,
      oldRole: target.role,
      newRole,
    });

    return {
      success: true,
      message: `User ${targetTelegramId} role changed from ${ROLE_LABELS[target.role]} to ${ROLE_LABELS[newRole]}`,
    };
  }
}
