/**
 * Invite command response formatter
 */
import { ROLE_LABELS } from "../../domain/models/AuthorizedUser.js";
import { GenerateInviteResult } from "../../domain/usecases/GenerateInviteUseCase.js";
import { ActivateInviteResult } from "../../domain/usecases/ActivateInviteUseCase.js";
import { UIResponse } from "../protocol/types.js";

export class InviteFormatter {
  constructor(private botUsername: string) {}

  /**
   * Format invite generation result
   */
  formatGenerateResult(result: GenerateInviteResult): UIResponse {
    switch (result.type) {
      case "success": {
        // Escape _ for Markdown (otherwise it's interpreted as italic)
        const link = `https://t.me/${this.botUsername}?start=inv\\_${result.token}`;
        const roleLabel = ROLE_LABELS[result.role];
        const expiresIn = this.formatExpiresIn(result.expiresAt);

        return {
          text: `Invite link created:\n${link}\n\nRole: ${roleLabel}\nExpires: ${expiresIn}`,
        };
      }
      case "not_authorized":
        return { text: "Error: You are not authorized to create invites." };
      case "cannot_create_role":
        return { text: `Error: You cannot create invites for role '${result.role}'.` };
    }
  }

  /**
   * Format invite activation result
   */
  formatActivateResult(result: ActivateInviteResult): UIResponse {
    switch (result.type) {
      case "success": {
        const roleLabel = ROLE_LABELS[result.role];
        return {
          text: `Welcome! You have been authorized as '${roleLabel}'.\nUse /help to see available commands.`,
        };
      }
      case "invalid_token":
        return { text: "Invalid invite link." };
      case "token_expired":
        return { text: "This invite link has expired." };
      case "token_already_used":
        return { text: "This invite link has already been used." };
      case "already_authorized":
        return { text: "You are already authorized. Use /help to see available commands." };
    }
  }

  /**
   * Format invite usage message
   */
  formatUsage(): UIResponse {
    return {
      text: `Usage: /admin invite [role]

Arguments:
  role - User role: user, admin (default: user)

Examples:
  /admin invite
  /admin invite user
  /admin invite admin

Note: Admins can only create invites for 'user' role.`,
    };
  }

  /**
   * Format time until expiration
   */
  private formatExpiresIn(expiresAt: Date): string {
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();

    if (diffMs <= 0) {
      return "expired";
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `in ${days} day${days !== 1 ? "s" : ""}`;
    }

    return `in ${hours} hour${hours !== 1 ? "s" : ""}`;
  }
}
