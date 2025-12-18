/**
 * Use case for activating invite tokens
 */
import { InviteTokenRepository } from "../repositories/InviteTokenRepository.js";
import { AuthRepository } from "../repositories/AuthRepository.js";
import { UserRole } from "../models/AuthorizedUser.js";
import { isTokenExpired, isTokenUsed } from "../models/InviteToken.js";

export type ActivateInviteResult =
  | { type: "success"; role: UserRole }
  | { type: "invalid_token" }
  | { type: "token_expired" }
  | { type: "token_already_used" }
  | { type: "already_authorized" };

export class ActivateInviteUseCase {
  constructor(
    private inviteTokenRepository: InviteTokenRepository,
    private authRepository: AuthRepository,
  ) {}

  async execute(token: string, telegramId: number): Promise<ActivateInviteResult> {
    // Check if user is already authorized
    const existingUser = await this.authRepository.getById(telegramId);
    if (existingUser) {
      return { type: "already_authorized" };
    }

    // Get token
    const inviteToken = await this.inviteTokenRepository.getByToken(token);
    if (!inviteToken) {
      return { type: "invalid_token" };
    }

    // Check if token is expired
    if (isTokenExpired(inviteToken)) {
      return { type: "token_expired" };
    }

    // Check if token is already used
    if (isTokenUsed(inviteToken)) {
      return { type: "token_already_used" };
    }

    // Mark token as used
    const marked = await this.inviteTokenRepository.markUsed(token, telegramId);
    if (!marked) {
      // Race condition - token was used by someone else
      return { type: "token_already_used" };
    }

    // Add user with the specified role
    await this.authRepository.add(telegramId, inviteToken.role, inviteToken.createdBy);

    return {
      type: "success",
      role: inviteToken.role,
    };
  }
}
