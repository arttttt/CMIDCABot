/**
 * AddAuthorizedUserUseCase - adds a new authorized user
 */

import type { TelegramId } from "../models/id/index.js";
import { AuthRepository } from "../repositories/AuthRepository.js";
import { UserRole, canManageRole, isAdminRole, ROLE_LABELS } from "../models/AuthorizedUser.js";
import { AuthorizationHelper } from "../helpers/AuthorizationHelper.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export type AddAuthorizedUserResult =
  | { success: true; message: string }
  | { success: false; error: string };

export class AddAuthorizedUserUseCase {
  constructor(
    private authRepository: AuthRepository,
    private authHelper: AuthorizationHelper,
  ) {}

  async execute(
    adminTelegramId: TelegramId,
    targetTelegramId: TelegramId,
    role: UserRole = "user",
  ): Promise<AddAuthorizedUserResult> {
    logger.info("AddAuthorizedUser", "Adding user", {
      admin: adminTelegramId,
      target: targetTelegramId,
      role,
    });

    // Check admin permissions
    const adminRole = await this.authHelper.getRole(adminTelegramId);
    if (!adminRole) {
      return { success: false, error: "Not authorized" };
    }

    if (!isAdminRole(adminRole)) {
      return { success: false, error: "Admin privileges required" };
    }

    if (!canManageRole(adminRole, role)) {
      return { success: false, error: `Cannot assign ${ROLE_LABELS[role]} role` };
    }

    // Cannot assign owner role
    if (role === "owner") {
      return { success: false, error: "Cannot assign owner role" };
    }

    // Check if user already exists
    const existing = await this.authRepository.getById(targetTelegramId);
    if (existing) {
      return {
        success: false,
        error: `User ${targetTelegramId} is already authorized as ${ROLE_LABELS[existing.role]}`,
      };
    }

    // Add user
    await this.authRepository.add(targetTelegramId, role, adminTelegramId);

    logger.info("AddAuthorizedUser", "User added", {
      admin: adminTelegramId,
      target: targetTelegramId,
      role,
    });

    return {
      success: true,
      message: `User ${targetTelegramId} added as ${ROLE_LABELS[role]}`,
    };
  }
}
