import { Bot, Context } from "grammy";
import { Config } from "../types/index.js";

export function createBot(config: Config): Bot<Context> {
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

  // Commands
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "DCA Bot for Solana\n\n" +
        "Commands:\n" +
        "/status - Portfolio status\n" +
        "/balance - Check balances\n" +
        "/help - Show help",
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "Healthy Crypto Index DCA Bot\n\n" +
        "Target allocations:\n" +
        "- BTC: 40%\n" +
        "- ETH: 30%\n" +
        "- SOL: 30%\n\n" +
        "The bot purchases the asset furthest below its target allocation.",
    );
  });

  bot.command("status", async (ctx) => {
    await ctx.reply("Portfolio status: Not implemented yet");
  });

  bot.command("balance", async (ctx) => {
    await ctx.reply("Balance check: Not implemented yet");
  });

  // Error handling
  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  return bot;
}
