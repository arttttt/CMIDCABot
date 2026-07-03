/**
 * Use case for generating invite tokens
 */
import type { TelegramId } from "../models/id/index.js";
import { InviteTokenRepository } from "../repositories/InviteTokenRepository.js";
import { AuthRepository } from "../repositories/AuthRepository.js";
import { UserRole } from "../models/AuthorizedUser.js";
import { AuthorizationPolicy } from "../policies/AuthorizationPolicy.js";
import { INVITE_TOKEN_EXPIRY_MS } from "../models/InviteToken.js";

export type GenerateInviteResult =
  | { type: "success"; token: string; role: UserRole; expiresAt: Date }
  | { type: "not_authorized" }
  | { type: "cannot_create_role"; role: UserRole };

export class GenerateInviteUseCase {
  constructor(
    private inviteTokenRepository: InviteTokenRepository,
    private authRepository: AuthRepository,
  ) {}

  async execute(creatorTelegramId: TelegramId, role: UserRole = "user"): Promise<GenerateInviteResult> {
    // Get creator's info
    const creator = await this.authRepository.getById(creatorTelegramId);
    if (!creator) {
      return { type: "not_authorized" };
    }

    // Check if creator can create invites for this role
    // Owner can create any role (except owner)
    // Admin can only create user role
    if (role === "owner") {
      return { type: "cannot_create_role", role };
    }

    if (!AuthorizationPolicy.canManageRole(creator.role, role)) {
      return { type: "cannot_create_role", role };
    }

    // Calculate expiration
    const expiresAt = new Date(Date.now() + INVITE_TOKEN_EXPIRY_MS);

    // Create token (generated and hashed by the repository)
    const token = await this.inviteTokenRepository.create(role, creatorTelegramId, expiresAt);

    return {
      type: "success",
      token,
      role,
      expiresAt,
    };
  }
}
