/**
 * AuthorizationHelper - permission checks for use cases
 *
 * This helper provides authorization checks without containing business logic.
 * All mutations (add/remove/update) are handled by dedicated use cases.
 */

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
  constructor(
    private authRepository: AuthRepository,
    private ownerTelegramId: number,
  ) {}

  /**
   * Check if a user is authorized to use the bot
   */
  async checkAuthorization(telegramId: number): Promise<AuthCheckResult> {
    // Owner is always authorized
    if (telegramId === this.ownerTelegramId) {
      const user = await this.authRepository.getById(telegramId);
      return { authorized: true, user: user ?? this.createOwnerUser() };
    }

    const user = await this.authRepository.getById(telegramId);
    if (user) {
      return { authorized: true, user };
    }

    return { authorized: false };
  }

  /**
   * Check if a user is authorized (simple boolean check)
   */
  async isAuthorized(telegramId: number): Promise<boolean> {
    if (telegramId === this.ownerTelegramId) return true;
    return this.authRepository.isAuthorized(telegramId);
  }

  /**
   * Check if a user has admin privileges
   */
  async isAdmin(telegramId: number): Promise<boolean> {
    if (telegramId === this.ownerTelegramId) return true;

    const user = await this.authRepository.getById(telegramId);
    return user !== undefined && isAdminRole(user.role);
  }

  /**
   * Get user's role
   * @deprecated Use GetUserRoleUseCase instead. This method will be removed in future versions.
   */
  async getRole(telegramId: number): Promise<UserRole | undefined> {
    if (telegramId === this.ownerTelegramId) return "owner";

    const user = await this.authRepository.getById(telegramId);
    return user?.role;
  }

  /**
   * Get owner telegram ID
   */
  getOwnerTelegramId(): number {
    return this.ownerTelegramId;
  }

  /**
   * Create a virtual owner user (when not yet in DB)
   */
  private createOwnerUser(): AuthorizedUser {
    return {
      telegramId: this.ownerTelegramId,
      role: "owner",
      addedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
