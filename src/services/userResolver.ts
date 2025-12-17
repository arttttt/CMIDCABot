/**
 * User resolver service - resolves usernames to Telegram IDs
 */

import { Api } from "grammy";
import { logger } from "./logger.js";

/**
 * Result of resolving a user identifier
 */
export interface ResolveResult {
  success: boolean;
  telegramId?: number;
  error?: string;
}

/**
 * Interface for resolving user identifiers to Telegram IDs
 */
export interface UserResolver {
  /**
   * Resolve a user identifier (username or telegram ID) to a Telegram ID
   * @param identifier - Username (with or without @) or numeric Telegram ID
   * @returns ResolveResult with the resolved Telegram ID or error
   */
  resolve(identifier: string): Promise<ResolveResult>;
}

/**
 * Check if identifier looks like a username
 */
export function isUsername(identifier: string): boolean {
  // Username starts with @ or is alphanumeric (not purely numeric)
  if (identifier.startsWith("@")) {
    return true;
  }
  // If it's not a pure number, treat as username
  return !/^\d+$/.test(identifier);
}

/**
 * Parse identifier - returns telegramId if numeric, undefined otherwise
 */
export function parseNumericId(identifier: string): number | undefined {
  const id = parseInt(identifier, 10);
  if (isNaN(id) || id <= 0) {
    return undefined;
  }
  return id;
}

/**
 * Normalize username - remove @ if present
 */
export function normalizeUsername(username: string): string {
  return username.startsWith("@") ? username.slice(1) : username;
}

/**
 * Telegram-based user resolver using Bot API
 */
export class TelegramUserResolver implements UserResolver {
  private api: Api | null = null;

  /**
   * Set the Bot API instance
   * Called after bot is created since resolver is created before bot
   */
  setApi(api: Api): void {
    this.api = api;
  }

  /**
   * Check if API is available
   */
  hasApi(): boolean {
    return this.api !== null;
  }

  async resolve(identifier: string): Promise<ResolveResult> {
    // If it's a numeric ID, return directly
    if (!isUsername(identifier)) {
      const telegramId = parseNumericId(identifier);
      if (!telegramId) {
        return {
          success: false,
          error: `Invalid Telegram ID: ${identifier}`,
        };
      }
      return { success: true, telegramId };
    }

    // It's a username - need to resolve via API
    if (!this.api) {
      return {
        success: false,
        error: "Bot API not initialized. Cannot resolve usernames.",
      };
    }

    const username = normalizeUsername(identifier);

    try {
      // Use getChat to get user info by username
      const chat = await this.api.getChat(`@${username}`);

      if (chat.type !== "private") {
        return {
          success: false,
          error: `@${username} is not a user (it's a ${chat.type})`,
        };
      }

      logger.debug("UserResolver", "Resolved username", {
        username,
        telegramId: chat.id,
      });

      return { success: true, telegramId: chat.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Check for common error patterns
      if (message.includes("chat not found") || message.includes("400")) {
        return {
          success: false,
          error: `User @${username} not found. Make sure the username is correct and the user has started the bot.`,
        };
      }

      logger.debug("UserResolver", "Failed to resolve username", {
        username,
        error: message,
      });

      return {
        success: false,
        error: `Failed to resolve @${username}: ${message}`,
      };
    }
  }
}

/**
 * Stub resolver for testing - only handles numeric IDs
 */
export class StubUserResolver implements UserResolver {
  async resolve(identifier: string): Promise<ResolveResult> {
    if (isUsername(identifier)) {
      return {
        success: false,
        error: "Username resolution not available in this mode",
      };
    }

    const telegramId = parseNumericId(identifier);
    if (!telegramId) {
      return {
        success: false,
        error: `Invalid Telegram ID: ${identifier}`,
      };
    }

    return { success: true, telegramId };
  }
}
