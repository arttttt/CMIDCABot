/**
 * Telegram adapter - grammY <-> protocol mapping
 * Pure mapping, no logic
 */

import { Bot, Context, InlineKeyboard } from "grammy";
import { ProtocolHandler } from "../protocol/index.js";
import { UIResponse } from "../protocol/types.js";
import { logger } from "../../services/logger.js";
import type { Message } from "grammy/types";

function toInlineKeyboard(response: UIResponse): InlineKeyboard | undefined {
  if (!response.buttons?.length) return undefined;

  const keyboard = new InlineKeyboard();
  for (const row of response.buttons) {
    for (const button of row) {
      keyboard.text(button.text, button.callbackData);
    }
    keyboard.row();
  }
  return keyboard;
}

async function sendResponse(ctx: Context, response: UIResponse): Promise<Message.TextMessage> {
  const keyboard = toInlineKeyboard(response);
  if (keyboard) {
    return await ctx.reply(response.text, { reply_markup: keyboard, parse_mode: "Markdown" });
  } else {
    return await ctx.reply(response.text, { parse_mode: "Markdown" });
  }
}

/**
 * Schedule auto-deletion of a message
 */
function scheduleMessageDeletion(
  bot: Bot<Context>,
  chatId: number,
  messageId: number,
  delaySeconds: number,
): void {
  setTimeout(async () => {
    try {
      await bot.api.deleteMessage(chatId, messageId);
      logger.debug("TelegramBot", "Auto-deleted sensitive message", { chatId, messageId });
    } catch (error) {
      // Message may already be deleted by user or expired
      logger.debug("TelegramBot", "Failed to auto-delete message", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, delaySeconds * 1000);
}

export function createTelegramBot(
  botToken: string,
  handler: ProtocolHandler,
  isDev: boolean,
): Bot<Context> {
  const bot = new Bot<Context>(botToken);

  // Debug middleware for local development
  if (isDev) {
    bot.use(async (ctx, next) => {
      const start = Date.now();
      const user = ctx.from;
      const chat = ctx.chat;
      const text = ctx.message?.text ?? ctx.callbackQuery?.data ?? "[no text]";

      logger.debug("TelegramBot", "Incoming message", {
        user: user?.username ?? user?.id ?? "unknown",
        chatId: chat?.id ?? "unknown",
        message: text,
      });

      await next();

      const ms = Date.now() - start;
      logger.debug("TelegramBot", "Response sent", { responseTimeMs: ms });
    });
  }

  // Handle text messages: Context -> Protocol -> Response
  bot.on("message:text", async (ctx) => {
    const response = await handler.handleMessage({
      userId: String(ctx.from.id),
      telegramId: ctx.from.id,
      username: ctx.from.username,
      text: ctx.message.text,
    });

    // Delete user's message if it contains sensitive data (e.g., private keys)
    if (response.deleteUserMessage) {
      try {
        await ctx.deleteMessage();
      } catch (error) {
        // Deletion may fail if bot lacks permissions or message is too old
        logger.debug("TelegramBot", "Failed to delete user message", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const sentMessage = await sendResponse(ctx, response);

    // Schedule auto-deletion for sensitive messages (e.g., exported private keys)
    if (response.autoDeleteSeconds && ctx.chat) {
      scheduleMessageDeletion(bot, ctx.chat.id, sentMessage.message_id, response.autoDeleteSeconds);
    }
  });

  // Handle callback queries: Context -> Protocol -> Edit message
  bot.on("callback_query:data", async (ctx) => {
    const callbackData = ctx.callbackQuery.data;

    // Handle delete_sensitive callback - delete the message immediately
    if (callbackData === "delete_sensitive") {
      try {
        await ctx.deleteMessage();
        await ctx.answerCallbackQuery({ text: "Message deleted" });
        logger.debug("TelegramBot", "Deleted sensitive message via callback", {
          userId: ctx.from.id,
        });
      } catch (error) {
        await ctx.answerCallbackQuery({ text: "Failed to delete message" });
        logger.debug("TelegramBot", "Failed to delete message via callback", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    // Handle regular callbacks via protocol handler
    const response = await handler.handleCallback({
      telegramId: ctx.from.id,
      callbackData: callbackData,
    });

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(response.text, { parse_mode: "Markdown" });
  });

  // Error handling
  bot.catch((err) => {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("TelegramBot", "Bot error", { error: message });
  });

  return bot;
}
