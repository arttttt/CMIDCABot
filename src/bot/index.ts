import { Bot, Context, InlineKeyboard } from "grammy";
import { Config } from "../types/index.js";
import {
  handleMessage,
  handleCallback,
  ServiceContext,
  MessageResponse,
} from "../handlers/index.js";

/**
 * Send response with optional inline keyboard
 */
async function sendResponse(
  ctx: Context,
  response: MessageResponse,
): Promise<void> {
  if (response.inlineKeyboard) {
    const keyboard = new InlineKeyboard();
    for (const row of response.inlineKeyboard) {
      for (const button of row) {
        keyboard.text(button.text, button.callbackData);
      }
      keyboard.row();
    }
    await ctx.reply(response.text, { reply_markup: keyboard });
  } else {
    await ctx.reply(response.text);
  }
}

export function createBot(
  config: Config,
  services: ServiceContext,
): Bot<Context> {
  const bot = new Bot<Context>(config.telegram.botToken);

  // Debug middleware for local development
  if (config.isDev) {
    bot.use(async (ctx, next) => {
      const start = Date.now();
      const user = ctx.from;
      const chat = ctx.chat;
      const text = ctx.message?.text ?? ctx.callbackQuery?.data ?? "[no text]";

      console.log(
        `[DEBUG] ${new Date().toISOString()} | ` +
          `User: ${user?.username ?? user?.id ?? "unknown"} | ` +
          `Chat: ${chat?.id ?? "unknown"} | ` +
          `Message: ${text}`,
      );

      await next();

      const ms = Date.now() - start;
      console.log(`[DEBUG] Response time: ${ms}ms`);
    });
  }

  // Handle all text messages through unified handler
  bot.on("message:text", async (ctx) => {
    const response = await handleMessage(
      {
        userId: String(ctx.from.id),
        telegramId: ctx.from.id,
        username: ctx.from.username,
        text: ctx.message.text,
      },
      services,
    );
    await sendResponse(ctx, response);
  });

  // Handle callback queries (inline button clicks)
  bot.on("callback_query:data", async (ctx) => {
    const response = await handleCallback(
      ctx.from.id,
      ctx.callbackQuery.data,
      services,
    );

    // Answer callback to remove loading state
    await ctx.answerCallbackQuery();

    // Edit the original message with the result
    await ctx.editMessageText(response.text);
  });

  // Error handling
  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  return bot;
}
