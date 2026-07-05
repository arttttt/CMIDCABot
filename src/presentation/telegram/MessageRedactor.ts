/**
 * MessageRedactor - hides sensitive messages after a TTL
 *
 * Sensitive responses (balances, amounts, addresses) stay visible for
 * a short period, then the message is edited to a placeholder and its
 * inline keyboard is removed. Timers live in memory: a restart within
 * the TTL window leaves the message unhidden (accepted trade-off for
 * a single-owner bot).
 */

import type { Api } from "grammy";
import { logger } from "../../infrastructure/shared/logging/index.js";

const REDACTION_TTL_MS = 60_000;
const PLACEHOLDER_TEXT = "🔒 Data hidden. Run the command again to view.";

export class MessageRedactor {
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(private ttlMs: number = REDACTION_TTL_MS) {}

  /**
   * Schedule hiding of a rendered sensitive message.
   * Re-scheduling the same message resets its timer.
   */
  schedule(api: Api, chatId: number, messageId: number): void {
    this.cancel(chatId, messageId);

    const key = this.key(chatId, messageId);
    const timer = setTimeout(() => {
      this.timers.delete(key);
      void this.redact(api, chatId, messageId);
    }, this.ttlMs);
    // Pending redactions must not keep the process alive on shutdown
    timer.unref();
    this.timers.set(key, timer);
  }

  /**
   * Cancel a pending redaction (message re-rendered with
   * non-sensitive content).
   */
  cancel(chatId: number, messageId: number): void {
    const key = this.key(chatId, messageId);
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  private async redact(api: Api, chatId: number, messageId: number): Promise<void> {
    try {
      // Omitting reply_markup also removes the inline keyboard
      await api.editMessageText(chatId, messageId, PLACEHOLDER_TEXT);
    } catch (error) {
      logger.debug("MessageRedactor", "Failed to hide message", {
        chatId,
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private key(chatId: number, messageId: number): string {
    return `${chatId}:${messageId}`;
  }
}
