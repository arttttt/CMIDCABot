/**
 * Telegram adapter - grammY <-> protocol mapping
 * Handles streaming progress with message updates
 */

import { Bot, BotError, Context, InlineKeyboard } from "grammy";
import type { Gateway } from "../protocol/gateway/Gateway.js";
import type { GatewayRequest } from "../protocol/gateway/types.js";
import { ClientResponse, StreamItem } from "../protocol/types.js";
import { logger, LogSanitizer } from "../../infrastructure/shared/logging/index.js";
import {
  tryWithRetry,
  TelegramErrorClassifier,
} from "../../infrastructure/shared/resilience/index.js";
import { TelegramErrorMessages } from "./ErrorMessages.js";

const ERROR_MESSAGE_SEND_FAILED = "Failed to send message. Please try the command again.";

// Callback data validation constants (SEC-03)
const CALLBACK_MAX_LENGTH = 64;
const CALLBACK_PATTERN = /^[a-z][a-z0-9_]*(\/[a-z][a-z0-9_]*)*:[a-z][a-z0-9_]*$/;

function buildTelegramMessageRequest(ctx: Context): GatewayRequest {
  return {
    kind: "telegram-message",
    identity: {
      provider: "telegram",
      telegramId: ctx.from!.id,
    },
    text: ctx.message!.text!,
    username: ctx.from!.username,
  };
}

function buildTelegramCallbackRequest(ctx: Context): GatewayRequest {
  return {
    kind: "telegram-callback",
    identity: {
      provider: "telegram",
      telegramId: ctx.from!.id,
    },
    callbackData: ctx.callbackQuery!.data!,
  };
}

function toInlineKeyboard(response: ClientResponse): InlineKeyboard | undefined {
  if (!response.buttons?.length) return undefined;

  const keyboard = new InlineKeyboard();
  for (const row of response.buttons) {
    for (const button of row) {
      if (button.url) {
        // URL button - opens external link
        keyboard.url(button.text, button.url);
      } else if (button.callbackData) {
        // Callback button - triggers bot callback
        keyboard.text(button.text, button.callbackData);
      }
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
  stream: AsyncGenerator<StreamItem, void, undefined>,
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
          const messageId = statusMessageId;
          await tryWithRetry(
            () => ctx.api.editMessageText(chatId, messageId, item.response.text, {
              parse_mode: "Markdown",
              reply_markup: keyboard,
            }),
            (error) => {
              // Edit might fail if content is the same - ignore
              logger.debug("TelegramBot", "Edit message failed", {
                error: error instanceof Error ? error.message : String(error),
              });
            },
          );
        } else {
          // First message - send new with retry
          const msg = await tryWithRetry(
            () => ctx.reply(item.response.text, {
              parse_mode: "Markdown",
              reply_markup: keyboard,
            }),
            (error) => {
              logger.error("TelegramBot", "Failed to send initial status message", {
                error: error instanceof Error ? error.message : String(error),
              });
            },
          );

          if (msg) {
            statusMessageId = msg.message_id;
          } else {
            // Retry failed - try to send error message to user
            try {
              await ctx.reply(ERROR_MESSAGE_SEND_FAILED);
            } catch {
              // Nothing more we can do
            }
          }
        }
        break;
      }

      case "new": {
        // Send new message (keep status message for future updates) with retry
        const sent = await tryWithRetry(
          () => ctx.reply(item.response.text, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          }),
          (error) => {
            logger.error("TelegramBot", "Failed to send new message", {
              error: error instanceof Error ? error.message : String(error),
            });
          },
        );

        if (!sent) {
          // Retry failed - try to send error message to user
          try {
            await ctx.reply(ERROR_MESSAGE_SEND_FAILED);
          } catch {
            // Nothing more we can do
          }
        }
        break;
      }

      case "final": {
        // Final result - update status message or send new
        let finalSent = false;

        if (statusMessageId) {
          try {
            await ctx.api.editMessageText(chatId, statusMessageId, item.response.text, {
              parse_mode: "Markdown",
              reply_markup: keyboard,
            });
            finalSent = true;
          } catch (error) {
            // If edit fails, try to send new message with retry
            logger.debug("TelegramBot", "Final edit failed, sending new", {
              error: error instanceof Error ? error.message : String(error),
            });

            const sent = await tryWithRetry(
              () => ctx.reply(item.response.text, {
                parse_mode: "Markdown",
                reply_markup: keyboard,
              }),
              (retryError) => {
                logger.error("TelegramBot", "Failed to send final message", {
                  error: retryError instanceof Error ? retryError.message : String(retryError),
                });
              },
            );
            finalSent = !!sent;
          }
        } else {
          const sent = await tryWithRetry(
            () => ctx.reply(item.response.text, {
              parse_mode: "Markdown",
              reply_markup: keyboard,
            }),
            (error) => {
              logger.error("TelegramBot", "Failed to send final message", {
                error: error instanceof Error ? error.message : String(error),
              });
            },
          );
          finalSent = !!sent;
        }

        if (!finalSent) {
          // Retry failed - try to send error message to user
          try {
            await ctx.reply(ERROR_MESSAGE_SEND_FAILED);
          } catch {
            // Nothing more we can do
          }
        }
        break;
      }
    }
  }
}

export function createTelegramBot(
  botToken: string,
  gateway: Gateway,
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

  // Handle text messages: Context -> Gateway -> Streaming Response
  bot.on("message:text", async (ctx) => {
    const request = buildTelegramMessageRequest(ctx);
    const stream = await gateway.handle(request);
    await handleStreamingResponse(ctx, stream);
  });

  // Handle callback queries: Context -> Gateway -> Edit message
  bot.on("callback_query:data", async (ctx) => {
    const callbackData = ctx.callbackQuery.data;

    // Validate callback data format (SEC-03)
    if (callbackData.length > CALLBACK_MAX_LENGTH) {
      logger.warn("TelegramBot", "Invalid callback data: too long", {
        userId: ctx.from.id,
        length: callbackData.length,
      });
      await ctx.answerCallbackQuery().catch(() => {});
      return;
    }

    if (!CALLBACK_PATTERN.test(callbackData)) {
      logger.warn("TelegramBot", "Invalid callback data: format mismatch", {
        userId: ctx.from.id,
        length: callbackData.length,
      });
      await ctx.answerCallbackQuery().catch(() => {});
      return;
    }

    // Handle callbacks via gateway
    const request = buildTelegramCallbackRequest(ctx);
    const stream = await gateway.handle(request);

    // Callback returns single final response - extract it
    let response: ClientResponse | undefined;
    for await (const item of stream) {
      response = item.response;
    }

    if (response) {
      const keyboard = toInlineKeyboard(response);
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(response.text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    } else {
      await ctx.answerCallbackQuery();
    }
  });

  // Error handling with user notification
  bot.catch(async (err: BotError<Context>) => {
    const error = err.error;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Classify the error
    const errorType = TelegramErrorClassifier.classify(error);
    const userMessage = TelegramErrorMessages.getMessage(errorType);

    // Log with description if available
    const description = TelegramErrorClassifier.getDescription(error);
    logger.error("TelegramBot", "Bot error", {
      error: errorMessage,
      errorType,
      ...(description && { description }),
    });

    // Try to notify the user (skip for Forbidden - bot is blocked)
    if (!TelegramErrorMessages.shouldNotifyUser(errorType)) {
      return;
    }

    const ctx = err.ctx;
    const chatId = ctx?.chat?.id;

    if (chatId && userMessage) {
      try {
        await ctx.api.sendMessage(chatId, userMessage);
      } catch (sendError) {
        // Failed to send error message - nothing more we can do
        logger.debug("TelegramBot", "Failed to send error notification to user", {
          error: sendError instanceof Error ? sendError.message : String(sendError),
        });
      }
    }
  });

  return bot;
}
