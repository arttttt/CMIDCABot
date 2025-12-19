/**
 * Telegram adapter - grammY <-> protocol mapping
 * Pure mapping, no logic
 */

import { Bot, Context, InlineKeyboard } from "grammy";
import { ProtocolHandler } from "../protocol/index.js";
import { UIResponse } from "../protocol/types.js";
import { logger, redactSensitiveData } from "../../services/logger.js";

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

async function sendResponse(ctx: Context, response: UIResponse): Promise<void> {
  const keyboard = toInlineKeyboard(response);
  if (keyboard) {
    await ctx.reply(response.text, { reply_markup: keyboard, parse_mode: "Markdown" });
  } else {
    await ctx.reply(response.text, { parse_mode: "Markdown" });
  }
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
        message: redactSensitiveData(text),
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

    await sendResponse(ctx, response);
  });

  // Handle callback queries: Context -> Protocol -> Edit message
  bot.on("callback_query:data", async (ctx) => {
    const callbackData = ctx.callbackQuery.data;

    // Handle delete_sensitive callback - replace message with success text
    if (callbackData === "delete_sensitive") {
      try {
        await ctx.editMessageText(
          "**Private key exported successfully.**\n\n" +
            "The key has been removed from this chat for security.",
          { parse_mode: "Markdown" },
        );
        await ctx.answerCallbackQuery({ text: "Key removed from chat" });
        logger.debug("TelegramBot", "Replaced sensitive message with success text", {
          userId: ctx.from.id,
        });
      } catch (error) {
        await ctx.answerCallbackQuery({ text: "Failed to update message" });
        logger.debug("TelegramBot", "Failed to replace sensitive message", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    // Handle mnemonic_saved callback - replace message with confirmation
    if (callbackData === "mnemonic_saved") {
      try {
        await ctx.editMessageText(
          "**Wallet Created Successfully!**\n\n" +
            "Your recovery phrase has been hidden for security.\n\n" +
            "**Remember:**\n" +
            "- Keep your recovery phrase in a safe place\n" +
            "- Never share it with anyone\n" +
            "- You can import it into Phantom, Solflare, or other Solana wallets\n\n" +
            "Use /wallet to view your wallet details.",
          { parse_mode: "Markdown" },
        );
        await ctx.answerCallbackQuery({ text: "Recovery phrase hidden" });
        logger.debug("TelegramBot", "Hid mnemonic after user confirmation", {
          userId: ctx.from.id,
        });
      } catch (error) {
        await ctx.answerCallbackQuery({ text: "Failed to update message" });
        logger.debug("TelegramBot", "Failed to hide mnemonic", {
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

    const keyboard = toInlineKeyboard(response);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(response.text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  });

  // Error handling
  bot.catch((err) => {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("TelegramBot", "Bot error", { error: message });
  });

  return bot;
}
