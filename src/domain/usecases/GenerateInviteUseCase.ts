/**
 * Use case for generating invite tokens
 */
import { randomBytes } from "crypto";
import type { TelegramId } from "../../types/id/index.js";
import { InviteTokenRepository } from "../repositories/InviteTokenRepository.js";
import { AuthRepository } from "../repositories/AuthRepository.js";
import { UserRole, canManageRole } from "../models/AuthorizedUser.js";
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

    if (!canManageRole(creator.role, role)) {
      return { type: "cannot_create_role", role };
    }

    // Generate cryptographically secure token (16 bytes = 22 base64url chars)
    const tokenBuffer = randomBytes(16);
    const token = tokenBuffer.toString("base64url");

    // Calculate expiration
    const expiresAt = new Date(Date.now() + INVITE_TOKEN_EXPIRY_MS);

    // Store token
    await this.inviteTokenRepository.create(token, role, creatorTelegramId, expiresAt);

    return {
      type: "success",
      token,
      role,
      expiresAt,
    };
  }
}
