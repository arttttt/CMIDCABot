/**
 * Telegram adapter - grammY <-> protocol mapping
 * Handles streaming progress with message updates
 */

import { Bot, BotError, Context } from "grammy";
import { TelegramId } from "../../domain/models/id/index.js";
import { UserIdentity } from "../../domain/models/UserIdentity.js";
import type { Gateway } from "../protocol/gateway/Gateway.js";
import type { GatewayRequest } from "../protocol/gateway/types.js";
import { logger, LogSanitizer } from "../../infrastructure/shared/logging/index.js";
import { TelegramErrorClassifier } from "../../infrastructure/shared/resilience/index.js";
import { TelegramErrorMessages } from "./ErrorMessages.js";
import { StreamRenderer } from "./StreamRenderer.js";
import { MessageRedactor } from "./MessageRedactor.js";

// Callback data validation (SEC-03)
// Length check only - format validation moved to declarative schema in router.ts
const CALLBACK_MAX_LENGTH = 64;

function buildTelegramMessageRequest(ctx: Context): GatewayRequest {
  return {
    kind: "telegram-message",
    identity: UserIdentity.telegram(new TelegramId(ctx.from!.id)),
    text: ctx.message!.text!,
    username: ctx.from!.username,
  };
}

function buildTelegramCallbackRequest(ctx: Context): GatewayRequest {
  return {
    kind: "telegram-callback",
    identity: UserIdentity.telegram(new TelegramId(ctx.from!.id)),
    callbackData: ctx.callbackQuery!.data!,
  };
}

export function createTelegramBot(
  botToken: string,
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

/**
 * Attach gateway-backed update handlers to an already-created bot.
 *
 * Split from createTelegramBot so the bot can be initialized (botInfo
 * fetched) before the gateway is built, avoiding a second Bot instance.
 */
export function attachGateway(bot: Bot<Context>, gateway: Gateway): void {
  const redactor = new MessageRedactor();

  // Handle text messages: Context -> Gateway -> Streaming Response
  bot.on("message:text", async (ctx) => {
    const request = buildTelegramMessageRequest(ctx);
    const stream = await gateway.handle(request);
    await StreamRenderer.render(ctx, stream, { deleteUserMessage: true, redactor });
  });

  // Handle callback queries: Context -> Gateway -> Streaming Response
  bot.on("callback_query:data", async (ctx) => {
    const callbackData = ctx.callbackQuery.data;

    // Validate callback data length (SEC-03)
    // Length check prevents DoS; format validation is done declaratively at registration
    if (callbackData.length > CALLBACK_MAX_LENGTH) {
      logger.warn("TelegramBot", "Invalid callback data: too long", {
        userId: ctx.from.id,
        length: callbackData.length,
      });
      await ctx.answerCallbackQuery().catch(() => {});
      return;
    }

    await ctx.answerCallbackQuery().catch(() => {});

    // Handle callbacks via gateway
    const request = buildTelegramCallbackRequest(ctx);
    const stream = await gateway.handle(request);
    await StreamRenderer.render(ctx, stream, {
      statusMessageId: ctx.callbackQuery?.message?.message_id,
      redactor,
    });
  });
}
