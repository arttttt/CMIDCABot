/**
 * User resolver service - resolves usernames to Telegram IDs
 */

import { Api } from "grammy";
import { TelegramId } from "../../domain/models/id/index.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

/**
 * Result of resolving a user identifier
 */
export interface ResolveResult {
  success: boolean;
  telegramId?: TelegramId;
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
export function parseNumericId(identifier: string): TelegramId | undefined {
  const id = parseInt(identifier, 10);
  if (isNaN(id) || id <= 0) {
    return undefined;
  }
  return new TelegramId(id);
}

/**
 * Normalize username - remove @ if present
 */
export function normalizeUsername(username: string): string {
  return username.startsWith("@") ? username.slice(1) : username;
}

// Helper to create error result
const error = (message: string): ResolveResult => ({ success: false, error: message });

// Helper to create success result
const success = (tgId: TelegramId): ResolveResult => ({ success: true, telegramId: tgId });

/**
 * Telegram-based user resolver using Bot API
 */
export class TelegramUserResolver implements UserResolver {
  private api: Api | null = null;

  setApi(api: Api): void {
    this.api = api;
  }

  async resolve(identifier: string): Promise<ResolveResult> {
    // Numeric ID - parse and return directly
    if (!isUsername(identifier)) {
      const telegramId = parseNumericId(identifier);
      return telegramId ? success(telegramId) : error(`Invalid Telegram ID: ${identifier}`);
    }

    // Username - resolve via API
    if (!this.api) {
      return error("Bot API not initialized. Cannot resolve usernames.");
    }

    return this.resolveUsername(normalizeUsername(identifier));
  }

  private async resolveUsername(username: string): Promise<ResolveResult> {
    try {
      const chat = await this.api!.getChat(`@${username}`);

      if (chat.type !== "private") {
        return error(`@${username} is not a user (it's a ${chat.type})`);
      }

      const tgId = new TelegramId(chat.id);
      logger.debug("UserResolver", "Resolved username", { username, telegramId: tgId });
      return success(tgId);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.debug("UserResolver", "Failed to resolve username", { username, error: message });

      return error(
        message.includes("chat not found") || message.includes("400")
          ? `User @${username} not found. Make sure the username is correct and the user has started the bot.`
          : `Failed to resolve @${username}: ${message}`
      );
    }
  }
}
