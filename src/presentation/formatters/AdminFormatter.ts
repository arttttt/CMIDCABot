/**
 * Admin command response formatter
 */
import { AuthorizedUser, ROLE_LABELS, UserRole } from "../../domain/models/AuthorizedUser.js";
import { AdminOperationResult } from "../../services/authorization.js";
import { UIResponse } from "../protocol/types.js";

export class AdminFormatter {
  /**
   * Format add user usage message
   */
  formatAddUsage(): UIResponse {
    return {
      text: `Usage: /admin add <telegram_id> [role]

Arguments:
  telegram_id - User's Telegram ID (required)
  role - User role: user, admin (default: user)

Examples:
  /admin add 123456789
  /admin add 123456789 admin`,
    };
  }

  /**
   * Format remove user usage message
   */
  formatRemoveUsage(): UIResponse {
    return {
      text: `Usage: /admin remove <telegram_id>

Arguments:
  telegram_id - User's Telegram ID (required)

Example:
  /admin remove 123456789`,
    };
  }

  /**
   * Format role change usage message
   */
  formatRoleUsage(): UIResponse {
    return {
      text: `Usage: /admin role <telegram_id> <role>

Arguments:
  telegram_id - User's Telegram ID (required)
  role - New role: user, admin (required)

Example:
  /admin role 123456789 admin`,
    };
  }

  /**
   * Format operation result
   */
  formatResult(result: AdminOperationResult): UIResponse {
    if (result.success) {
      return { text: `${result.message}` };
    }
    return { text: `Error: ${result.error}` };
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
      const addedBy = user.addedBy ? ` (added by ${user.addedBy})` : "";
      lines.push(`${user.telegramId} - ${role}${addedBy}`);
    }

    lines.push("");
    lines.push(`Total: ${users.length} user(s)`);

    return { text: lines.join("\n") };
  }

  /**
   * Format admin help
   */
  formatHelp(): UIResponse {
    return {
      text: `Admin Commands:

/admin - Show this help
/admin list - List all authorized users
/admin add <id> [role] - Add a user
/admin remove <id> - Remove a user
/admin role <id> <role> - Change user's role

Roles: user, admin
Note: Owner cannot be modified.`,
    };
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
    return { text: `Invalid role: ${role}\nValid roles: user, admin` };
  }

  /**
   * Format invalid telegram ID message
   */
  formatInvalidTelegramId(id: string): UIResponse {
    return { text: `Invalid Telegram ID: ${id}\nTelegram ID must be a number.` };
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

/**
 * Parse telegram ID from string
 */
export function parseTelegramId(idStr: string): number | undefined {
  const id = parseInt(idStr, 10);
  if (isNaN(id) || id <= 0) {
    return undefined;
  }
  return id;
}
