/**
 * AuthorizationHelper - permission checks for use cases
 *
 * This helper provides authorization checks without containing business logic.
 * All mutations (add/remove/update) are handled by dedicated use cases.
 */

import { telegramId, type TelegramId } from "../models/id/index.js";
import { AuthRepository } from "../repositories/AuthRepository.js";
import { AuthorizedUser, UserRole, isAdminRole } from "../models/AuthorizedUser.js";

/**
 * Result of an authorization check
 */
export interface AuthCheckResult {
  authorized: boolean;
  user?: AuthorizedUser;
}

/**
 * Authorization helper - permission checks for use cases
 */
export class AuthorizationHelper {
  private ownerTelegramIdBranded: TelegramId;

  constructor(
    private authRepository: AuthRepository,
    ownerTelegramIdRaw: number,
  ) {
    this.ownerTelegramIdBranded = telegramId(ownerTelegramIdRaw);
  }

  /**
   * Check if a user is authorized to use the bot
   */
  async checkAuthorization(id: TelegramId): Promise<AuthCheckResult> {
    // Owner is always authorized
    if (id === this.ownerTelegramIdBranded) {
      const user = await this.authRepository.getById(id);
      return { authorized: true, user: user ?? this.createOwnerUser() };
    }

    const user = await this.authRepository.getById(id);
    if (user) {
      return { authorized: true, user };
    }

    return { authorized: false };
  }

  /**
   * Check if a user is authorized (simple boolean check)
   */
  async isAuthorized(id: TelegramId): Promise<boolean> {
    if (id === this.ownerTelegramIdBranded) return true;
    return this.authRepository.isAuthorized(id);
  }

  /**
   * Check if a user has admin privileges
   */
  async isAdmin(id: TelegramId): Promise<boolean> {
    if (id === this.ownerTelegramIdBranded) return true;

    const user = await this.authRepository.getById(id);
    return user !== undefined && isAdminRole(user.role);
  }

  /**
   * Get user's role
   * @deprecated Use GetUserRoleUseCase instead. This method will be removed in future versions.
   */
  async getRole(id: TelegramId): Promise<UserRole | undefined> {
    if (id === this.ownerTelegramIdBranded) return "owner";

    const user = await this.authRepository.getById(id);
    return user?.role;
  }

  /**
   * Get owner telegram ID
   */
  getOwnerTelegramId(): TelegramId {
    return this.ownerTelegramIdBranded;
  }

  /**
   * Create a virtual owner user (when not yet in DB)
   */
  private createOwnerUser(): AuthorizedUser {
    return {
      telegramId: this.ownerTelegramIdBranded,
      role: "owner",
      addedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
