/**
 * Admin command response formatter
 */
import { AuthorizedUser, ROLE_LABELS, UserRole } from "../../domain/models/AuthorizedUser.js";
import { AdminOperationResult } from "../../domain/usecases/types.js";
import { UIResponse } from "../protocol/types.js";
import { Markdown } from "./markdown.js";

// Re-export for backwards compatibility
export type { AdminOperationResult };

export class AdminFormatter {
  /**
   * Format add user usage message
   */
  formatAddUsage(): UIResponse {
    return {
      text: `Usage: /admin add <user> [role]

Arguments:
  user - Username (@username) or Telegram ID (required)
  role - User role: user, admin (default: user)

Examples:
  /admin add @username
  /admin add @username admin
  /admin add 123456789
  /admin add 123456789 admin`,
    };
  }

  /**
   * Format remove user usage message
   */
  formatRemoveUsage(): UIResponse {
    return {
      text: `Usage: /admin remove <user>

Arguments:
  user - Username (@username) or Telegram ID (required)

Examples:
  /admin remove @username
  /admin remove 123456789`,
    };
  }

  /**
   * Format role change usage message
   */
  formatRoleUsage(): UIResponse {
    return {
      text: `Usage: /admin role <user> <role>

Arguments:
  user - Username (@username) or Telegram ID (required)
  role - New role: user, admin (required)

Examples:
  /admin role @username admin
  /admin role 123456789 admin`,
    };
  }

  /**
   * Format operation result
   */
  formatResult(result: AdminOperationResult): UIResponse {
    if (result.success) {
      return { text: Markdown.escape(result.message ?? "") };
    }
    return { text: `Error: ${Markdown.escape(result.error ?? "")}` };
  }

  /**
   * Format user list
   */
  formatUserList(users: AuthorizedUser[]): UIResponse {
    if (users.length === 0) {
      return { text: "No authorized users." };
    }

    const lines = ["Authorized Users:", ""];

    for (const user of users) {
      const role = ROLE_LABELS[user.role];
      const addedBy = user.addedBy ? ` (added by ${Markdown.escape(String(user.addedBy))})` : "";
      lines.push(`${user.telegramId} - ${Markdown.escape(role)}${addedBy}`);
    }

    lines.push("");
    lines.push(`Total: ${users.length} user(s)`);

    return { text: lines.join("\n") };
  }

  /**
   * Format admin help
   */
  formatHelp(showInvite = false): UIResponse {
    const lines = [
      "Admin Commands:",
      "",
      "/admin - Show this help",
      "/admin list - List all authorized users",
      "/admin add <user> [role] - Add a user",
      "/admin remove <user> - Remove a user",
      "/admin role <user> <role> - Change user's role",
    ];

    if (showInvite) {
      lines.push("/admin invite [role] - Create invite link");
    }

    lines.push(
      "",
      "User can be specified as @username or Telegram ID.",
      "Roles: user, admin",
      "Note: Owner cannot be modified.",
    );

    return { text: lines.join("\n") };
  }

  /**
   * Format version info
   */
  formatVersion(version: string): UIResponse {
    return { text: `CMI DCA Bot v${version}` };
  }

  /**
   * Format permission denied message
   */
  formatPermissionDenied(): UIResponse {
    return { text: "Permission denied. Admin privileges required." };
  }

  /**
   * Format invalid role message
   */
  formatInvalidRole(role: string): UIResponse {
    return { text: `Invalid role: ${Markdown.escape(role)}\nValid roles: user, admin` };
  }

  /**
   * Format user resolve error message
   */
  formatResolveError(identifier: string, error?: string): UIResponse {
    if (error) {
      return { text: `Error: ${Markdown.escape(error)}` };
    }
    return { text: `Could not resolve user: ${Markdown.escape(identifier)}` };
  }
}

/**
 * Parse role from string
 */
export function parseRole(roleStr: string): UserRole | undefined {
  const normalized = roleStr.toLowerCase();
  if (normalized === "user" || normalized === "admin") {
    return normalized;
  }
  return undefined;
}
