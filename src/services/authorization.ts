/**
 * Authorization service - manages user access and permissions
 */
import { AuthRepository } from "../domain/repositories/AuthRepository.js";
import {
  AuthorizedUser,
  UserRole,
  canManageRole,
  isAdminRole,
  ROLE_LABELS,
} from "../domain/models/AuthorizedUser.js";
import { logger } from "./logger.js";

/**
 * Result of an authorization check
 */
export interface AuthCheckResult {
  authorized: boolean;
  user?: AuthorizedUser;
}

/**
 * Result of an admin operation
 */
export type AdminOperationResult =
  | { success: true; message: string }
  | { success: false; error: string };

/**
 * Authorization service
 *
 * Handles:
 * - User authorization checks
 * - Adding/removing users
 * - Role management
 * - Owner protection
 */
export class AuthorizationService {
  constructor(
    private authRepository: AuthRepository,
    private ownerTelegramId: number,
  ) {}

  /**
   * Initialize the authorization system
   * Ensures owner is always in the database
   */
  async initialize(): Promise<void> {
    const owner = await this.authRepository.getById(this.ownerTelegramId);
    if (!owner) {
      await this.authRepository.add(this.ownerTelegramId, "owner", null);
      logger.info("Authorization", "Owner initialized", { telegramId: this.ownerTelegramId });
    }
  }

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
   */
  async getRole(telegramId: number): Promise<UserRole | undefined> {
    if (telegramId === this.ownerTelegramId) return "owner";

    const user = await this.authRepository.getById(telegramId);
    return user?.role;
  }

  /**
   * Add a new user (admin operation)
   */
  async addUser(
    adminTelegramId: number,
    targetTelegramId: number,
    role: UserRole = "user",
  ): Promise<AdminOperationResult> {
    // Check admin permissions
    const adminCheck = await this.checkAdminPermission(adminTelegramId, role);
    if (!adminCheck.success) return adminCheck;

    // Cannot add owner role
    if (role === "owner") {
      return { success: false, error: "Cannot assign owner role" };
    }

    // Check if user already exists
    const existing = await this.authRepository.getById(targetTelegramId);
    if (existing) {
      return { success: false, error: `User ${targetTelegramId} is already authorized as ${ROLE_LABELS[existing.role]}` };
    }

    // Add user
    await this.authRepository.add(targetTelegramId, role, adminTelegramId);
    logger.info("Authorization", "User added", {
      admin: adminTelegramId,
      target: targetTelegramId,
      role,
    });

    return { success: true, message: `User ${targetTelegramId} added as ${ROLE_LABELS[role]}` };
  }

  /**
   * Remove a user (admin operation)
   */
  async removeUser(
    adminTelegramId: number,
    targetTelegramId: number,
  ): Promise<AdminOperationResult> {
    // Cannot remove owner
    if (targetTelegramId === this.ownerTelegramId) {
      return { success: false, error: "Cannot remove owner" };
    }

    // Get target user
    const target = await this.authRepository.getById(targetTelegramId);
    if (!target) {
      return { success: false, error: `User ${targetTelegramId} is not authorized` };
    }

    // Check admin permissions
    const adminCheck = await this.checkAdminPermission(adminTelegramId, target.role);
    if (!adminCheck.success) return adminCheck;

    // Remove user
    const removed = await this.authRepository.remove(targetTelegramId);
    if (!removed) {
      return { success: false, error: "Failed to remove user" };
    }

    logger.info("Authorization", "User removed", {
      admin: adminTelegramId,
      target: targetTelegramId,
    });

    return { success: true, message: `User ${targetTelegramId} removed` };
  }

  /**
   * Update a user's role (admin operation)
   */
  async updateRole(
    adminTelegramId: number,
    targetTelegramId: number,
    newRole: UserRole,
  ): Promise<AdminOperationResult> {
    // Cannot change owner
    if (targetTelegramId === this.ownerTelegramId) {
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

    // Check if admin can manage both current and new roles
    const adminRole = await this.getRole(adminTelegramId);
    if (!adminRole) {
      return { success: false, error: "Admin not found" };
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

    logger.info("Authorization", "Role updated", {
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

  /**
   * Get all authorized users
   */
  async getAllUsers(): Promise<AuthorizedUser[]> {
    return this.authRepository.getAll();
  }

  /**
   * Get user count
   */
  async getUserCount(): Promise<number> {
    return this.authRepository.count();
  }

  /**
   * Check if admin has permission to manage a role
   */
  private async checkAdminPermission(
    adminTelegramId: number,
    targetRole: UserRole,
  ): Promise<AdminOperationResult> {
    const adminRole = await this.getRole(adminTelegramId);
    if (!adminRole) {
      return { success: false, error: "Not authorized" };
    }

    if (!isAdminRole(adminRole)) {
      return { success: false, error: "Admin privileges required" };
    }

    if (!canManageRole(adminRole, targetRole)) {
      return { success: false, error: `Cannot manage ${ROLE_LABELS[targetRole]} users` };
    }

    return { success: true, message: "" };
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
