import { loadConfig } from "./config/index.js";
import { createBot } from "./bot/index.js";

async function main(): Promise<void> {
  console.log("Starting DCA Telegram Bot...");

  const config = loadConfig();
  const bot = createBot(config);

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log("Shutting down...");
    await bot.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log(`Network: ${config.solana.network}`);
  console.log(`RPC: ${config.solana.rpcUrl}`);

  await bot.start();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
