/**
 * Telegram adapter - grammY <-> protocol mapping
 * Pure mapping, no logic
 */

import { Bot, Context, InlineKeyboard } from "grammy";
import { ProtocolHandler } from "../protocol/index.js";
import { UIResponse } from "../protocol/types.js";

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

  // Handle text messages: Context -> Protocol -> Response
  bot.on("message:text", async (ctx) => {
    const response = await handler.handleMessage({
      userId: String(ctx.from.id),
      telegramId: ctx.from.id,
      username: ctx.from.username,
      text: ctx.message.text,
    });
    await sendResponse(ctx, response);
  });

  // Handle callback queries: Context -> Protocol -> Edit message
  bot.on("callback_query:data", async (ctx) => {
    const response = await handler.handleCallback({
      telegramId: ctx.from.id,
      callbackData: ctx.callbackQuery.data,
    });

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(response.text, { parse_mode: "Markdown" });
  });

  // Error handling
  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  return bot;
}
