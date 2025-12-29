/**
 * Invite command response formatter
 */
import { ROLE_LABELS } from "../../domain/models/AuthorizedUser.js";
import { GenerateInviteResult } from "../../domain/usecases/GenerateInviteUseCase.js";
import { ActivateInviteResult } from "../../domain/usecases/ActivateInviteUseCase.js";
import { ClientResponse } from "../protocol/types.js";
import { Markdown } from "./markdown.js";

export class InviteFormatter {
  constructor(private botUsername: string) {}

  /**
   * Format invite generation result
   */
  formatGenerateResult(result: GenerateInviteResult): ClientResponse {
    switch (result.type) {
      case "success": {
        // Build link and escape special Markdown characters
        const rawLink = `https://t.me/${this.botUsername}?start=inv_${result.token}`;
        const link = Markdown.escape(rawLink);
        const roleLabel = Markdown.escape(ROLE_LABELS[result.role]);
        const expiresIn = this.formatExpiresIn(result.expiresAt);

        return new ClientResponse(`Invite link created:\n${link}\n\nRole: ${roleLabel}\nExpires: ${expiresIn}`);
      }
      case "not_authorized":
        return new ClientResponse("Error: You are not authorized to create invites.");
      case "cannot_create_role":
        return new ClientResponse(`Error: You cannot create invites for role '${Markdown.escape(result.role ?? "")}'.`);
    }
  }

  /**
   * Format invite activation result
   */
  formatActivateResult(result: ActivateInviteResult): ClientResponse {
    switch (result.type) {
      case "success": {
        const roleLabel = Markdown.escape(ROLE_LABELS[result.role]);
        return new ClientResponse(`Welcome! You have been authorized as '${roleLabel}'.\nUse /help to see available commands.`);
      }
      case "invalid_token":
        return new ClientResponse("Invalid invite link.");
      case "token_expired":
        return new ClientResponse("This invite link has expired.");
      case "token_already_used":
        return new ClientResponse("This invite link has already been used.");
      case "already_authorized":
        return new ClientResponse("You are already authorized. Use /help to see available commands.");
    }
  }

  /**
   * Format invite usage message
   */
  formatUsage(): ClientResponse {
    return new ClientResponse(
      `Usage: /admin invite [role]

Arguments:
  role - User role: user, admin (default: user)

Examples:
  /admin invite
  /admin invite user
  /admin invite admin

Note: Admins can only create invites for 'user' role.`,
    );
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
