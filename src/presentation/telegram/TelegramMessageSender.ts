/**
 * TelegramMessageSender - sends messages to Telegram users via Bot API
 *
 * Adapter implementing MessageSender port for Telegram notifications
 * from non-Telegram contexts (e.g., HTTP handlers).
 */

import type { Api } from "grammy";
import type { TelegramId } from "../../domain/models/id/index.js";
import type { MessageSender } from "./MessageSender.js";
import type { ClientResponse } from "../protocol/types.js";
import { TelegramKeyboard } from "./keyboard.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export class TelegramMessageSender implements MessageSender {
  constructor(private readonly api: Api) {}

  async send(tgId: TelegramId, response: ClientResponse): Promise<void> {
    try {
      const keyboard = TelegramKeyboard.from(response);

      // Cast to number for grammY API
      await this.api.sendMessage(tgId.value, response.text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      logger.debug("TelegramMessageSender", "Message sent", { telegramId: tgId });
    } catch (error) {
      logger.error("TelegramMessageSender", "Failed to send message", {
        telegramId: tgId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't rethrow - notification failure shouldn't break the import flow
    }
  }
}
