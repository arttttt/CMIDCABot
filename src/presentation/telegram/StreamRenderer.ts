/**
 * StreamRenderer - renders a ClientResponseStream into Telegram messages
 *
 * One render loop for both text-message and callback flows:
 * - 'edit': update the status message (created/adopted on demand)
 * - 'new': send an additional message, keep the status message
 * - 'final': update the status message or send the result
 *
 * Edit failures fall back to sending a new message which becomes the
 * status message; "message is not modified" is treated as success so
 * identical content never produces duplicates.
 */

import type { Context, InlineKeyboard } from "grammy";
import type { StreamItem } from "../protocol/types.js";
import { TelegramKeyboard } from "./keyboard.js";
import { MessageRedactor } from "./MessageRedactor.js";
import { logger } from "../../infrastructure/shared/logging/index.js";
import { Retry } from "../../infrastructure/shared/resilience/index.js";

const ERROR_MESSAGE_SEND_FAILED = "Failed to send message. Please try the command again.";

export interface RenderStreamOptions {
  /** Existing message to use for status updates (e.g. the callback's origin message) */
  statusMessageId?: number;
  /** Honor deleteUserMessage on the first item (text-message flow only) */
  deleteUserMessage?: boolean;
  /** Schedules hiding of rendered sensitive responses */
  redactor?: MessageRedactor;
}

export class StreamRenderer {
  static async render(
    ctx: Context,
    stream: AsyncGenerator<StreamItem, void, undefined>,
    options: RenderStreamOptions = {},
  ): Promise<void> {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      logger.warn("TelegramBot", "No chat ID for streaming response");
      return;
    }

    let statusMessageId = options.statusMessageId;
    let isFirstItem = true;

    for await (const item of stream) {
      if (isFirstItem) {
        isFirstItem = false;
        if (options.deleteUserMessage && item.response.deleteUserMessage) {
          // Delete user message IMMEDIATELY to remove sensitive data from chat
          try {
            await ctx.deleteMessage();
          } catch (error) {
            logger.debug("TelegramBot", "Failed to delete user message", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      const keyboard = TelegramKeyboard.from(item.response);

      if (item.mode === "new") {
        const sentId = await this.send(ctx, chatId, item.response.text, keyboard);
        if (sentId !== undefined) {
          this.trackSensitivity(ctx, options.redactor, chatId, sentId, item);
        }
        continue;
      }

      // 'edit' and 'final': prefer updating the status message
      if (statusMessageId !== undefined) {
        const edited = await this.edit(ctx, chatId, statusMessageId, item.response.text, keyboard);
        if (edited) {
          this.trackSensitivity(ctx, options.redactor, chatId, statusMessageId, item);
          continue;
        }
      }

      // No status message yet (or edit failed) - send and adopt as status message
      const sentId = await this.send(ctx, chatId, item.response.text, keyboard);
      if (sentId !== undefined) {
        statusMessageId = sentId;
        this.trackSensitivity(ctx, options.redactor, chatId, sentId, item);
      }
    }
  }

  /**
   * Keep the redaction schedule in sync with the latest rendered
   * content of a message: sensitive -> (re)schedule hiding,
   * non-sensitive -> cancel any pending hide.
   */
  private static trackSensitivity(
    ctx: Context,
    redactor: MessageRedactor | undefined,
    chatId: number,
    messageId: number,
    item: StreamItem,
  ): void {
    if (!redactor) {
      return;
    }
    if (item.response.sensitive) {
      redactor.schedule(ctx.api, chatId, messageId);
    } else {
      redactor.cancel(chatId, messageId);
    }
  }

  /**
   * Edit a message; returns true on success, including the
   * "message is not modified" case (content already up to date).
   */
  private static async edit(
    ctx: Context,
    chatId: number,
    messageId: number,
    text: string,
    keyboard: InlineKeyboard | undefined,
  ): Promise<boolean> {
    try {
      await Retry.withRetry(
        () => ctx.api.editMessageText(chatId, messageId, text, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        }),
        1,
        1000,
        (error) => !this.isNotModified(error),
      );
      return true;
    } catch (error) {
      if (this.isNotModified(error)) {
        return true;
      }
      logger.debug("TelegramBot", "Edit message failed, sending new", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Send a message with retry; notifies the user on final failure.
   * Returns the sent message id, or undefined on failure.
   */
  private static async send(
    ctx: Context,
    chatId: number,
    text: string,
    keyboard: InlineKeyboard | undefined,
  ): Promise<number | undefined> {
    const sent = await Retry.tryWithRetry(
      () => ctx.api.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }),
      (error) => {
        logger.error("TelegramBot", "Failed to send message", {
          error: error instanceof Error ? error.message : String(error),
        });
      },
    );

    if (sent) {
      return sent.message_id;
    }

    // Retry failed - try to tell the user; nothing more we can do beyond that
    try {
      await ctx.api.sendMessage(chatId, ERROR_MESSAGE_SEND_FAILED);
    } catch {
      // Nothing more we can do
    }
    return undefined;
  }

  private static isNotModified(error: unknown): boolean {
    return error instanceof Error && /message is not modified/i.test(error.message);
  }
}
