/**
 * TelegramMessageSender - sends messages to Telegram users via Bot API
 *
 * Adapter implementing MessageSender port for Telegram notifications
 * from non-Telegram contexts (e.g., HTTP handlers).
 */

import type { Api } from "grammy";
import type { MessageSender } from "./MessageSender.js";
import type { UIResponse } from "../protocol/types.js";
import { InlineKeyboard } from "grammy";
import { logger } from "../../infrastructure/shared/logging/index.js";

function toInlineKeyboard(response: UIResponse): InlineKeyboard | undefined {
  if (!response.buttons?.length) return undefined;

  const keyboard = new InlineKeyboard();
  for (const row of response.buttons) {
    for (const button of row) {
      if (button.url) {
        keyboard.url(button.text, button.url);
      } else if (button.callbackData) {
        keyboard.text(button.text, button.callbackData);
      }
    }
    keyboard.row();
  }
  return keyboard;
}

export class TelegramMessageSender implements MessageSender {
  constructor(private readonly api: Api) {}

  async send(telegramId: number, response: UIResponse): Promise<void> {
    try {
      const keyboard = toInlineKeyboard(response);

      await this.api.sendMessage(telegramId, response.text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug("TelegramMessageSender", "Message sent", { telegramId });
    } catch (error) {
      logger.error("TelegramMessageSender", "Failed to send message", {
        telegramId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't rethrow - notification failure shouldn't break the import flow
    }
  }
}
