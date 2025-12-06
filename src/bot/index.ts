import { Bot, Context } from "grammy";
import { Config } from "../types/index.js";
import { handleMessage, ServiceContext } from "../handlers/index.js";

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
    await ctx.reply(response.text);
  });

  // Error handling
  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  return bot;
}
