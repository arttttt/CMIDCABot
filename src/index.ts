import { loadConfig } from "./config/index.js";
import { createBot } from "./bot/index.js";

async function main(): Promise<void> {
  console.log("Starting DCA Telegram Bot...");

  const config = loadConfig();
  const bot = createBot(config);

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log("\nShutting down...");
    await bot.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Get bot info and prepare for polling
  const botInfo = await bot.api.getMe();

  if (config.isDev) {
    // Delete any existing webhook to ensure polling works
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    console.log("─".repeat(50));
    console.log("🔧 DEVELOPMENT MODE");
    console.log("─".repeat(50));
    console.log(`Bot: @${botInfo.username}`);
    console.log(`Network: ${config.solana.network}`);
    console.log(`RPC: ${config.solana.rpcUrl}`);
    console.log(`Mode: Long Polling (local)`);
    console.log("─".repeat(50));
    console.log("Bot is ready! Send /start in Telegram to test.");
    console.log("Press Ctrl+C to stop.\n");
  } else {
    console.log(`Bot @${botInfo.username} starting...`);
    console.log(`Network: ${config.solana.network}`);
    console.log(`RPC: ${config.solana.rpcUrl}`);
  }

  await bot.start({
    onStart: (botInfo) => {
      if (!config.isDev) {
        console.log(`Bot @${botInfo.username} is running`);
      }
    },
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
