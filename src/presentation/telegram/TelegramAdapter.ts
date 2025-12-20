/**
 * Telegram adapter - grammY <-> protocol mapping
 * Handles streaming progress with message updates
 */

import { Bot, Context, InlineKeyboard } from "grammy";
import { ProtocolHandler } from "../protocol/index.js";
import { UIResponse, UIStreamItem } from "../protocol/types.js";
import { logger, LogSanitizer } from "../../services/logger.js";

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

/**
 * Handle streaming responses from protocol handler
 * - 'edit' mode: Update the status message
 * - 'new' mode: Send a new message (preserving previous)
 * - 'final' mode: Final result, update or send based on context
 *
 * If first item has deleteUserMessage=true, the user's message is deleted immediately.
 */
async function handleStreamingResponse(
  ctx: Context,
  stream: AsyncGenerator<UIStreamItem, void, undefined>,
): Promise<void> {
  let statusMessageId: number | undefined;
  let isFirstItem = true;
  const chatId = ctx.chat?.id;

  if (!chatId) {
    logger.warn("TelegramBot", "No chat ID for streaming response");
    return;
  }

  for await (const item of stream) {
    // Check deleteUserMessage from first item and delete immediately
    if (isFirstItem) {
      isFirstItem = false;
      if (item.response.deleteUserMessage) {
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

    const keyboard = toInlineKeyboard(item.response);

    switch (item.mode) {
      case "edit": {
        // Update status message (or create if first)
        if (statusMessageId) {
          try {
            await ctx.api.editMessageText(chatId, statusMessageId, item.response.text, {
              parse_mode: "Markdown",
              reply_markup: keyboard,
            });
          } catch (error) {
            // Edit might fail if content is the same - ignore
            logger.debug("TelegramBot", "Edit message failed", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        } else {
          // First message - send new
          try {
            const msg = await ctx.reply(item.response.text, {
              parse_mode: "Markdown",
              reply_markup: keyboard,
            });
            statusMessageId = msg.message_id;
          } catch (error) {
            logger.error("TelegramBot", "Failed to send initial status message", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        break;
      }

      case "new":
        // Send new message (keep status message for future updates)
        try {
          await ctx.reply(item.response.text, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          });
        } catch (error) {
          logger.error("TelegramBot", "Failed to send new message", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
        break;

      case "final":
        // Final result - update status message or send new
        if (statusMessageId) {
          try {
            await ctx.api.editMessageText(chatId, statusMessageId, item.response.text, {
              parse_mode: "Markdown",
              reply_markup: keyboard,
            });
          } catch (error) {
            // If edit fails, send new message
            logger.debug("TelegramBot", "Final edit failed, sending new", {
              error: error instanceof Error ? error.message : String(error),
            });
            try {
              await ctx.reply(item.response.text, {
                parse_mode: "Markdown",
                reply_markup: keyboard,
              });
            } catch (replyError) {
              logger.error("TelegramBot", "Failed to send final message", {
                error: replyError instanceof Error ? replyError.message : String(replyError),
              });
            }
          }
        } else {
          try {
            await ctx.reply(item.response.text, {
              parse_mode: "Markdown",
              reply_markup: keyboard,
            });
          } catch (error) {
            logger.error("TelegramBot", "Failed to send final message", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        break;
    }
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
        message: LogSanitizer.redactText(text),
      });

      await next();

      const ms = Date.now() - start;
      logger.debug("TelegramBot", "Response sent", { responseTimeMs: ms });
    });
  }

  // Handle text messages: Context -> Protocol -> Streaming Response
  bot.on("message:text", async (ctx) => {
    const messageContext = {
      userId: String(ctx.from.id),
      telegramId: ctx.from.id,
      username: ctx.from.username,
      text: ctx.message.text,
    };

    // Use streaming handler for all commands
    // deleteUserMessage is handled inside handleStreamingResponse (immediate deletion)
    const stream = handler.handleMessageStreaming(messageContext);
    await handleStreamingResponse(ctx, stream);
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
