import { loadConfig } from "./config/index.js";
import { createBot } from "./bot/index.js";
import { startWebServer } from "./web/index.js";
import { DatabaseService } from "./db/index.js";
import { SolanaService } from "./services/solana.js";
import { DcaService } from "./services/dca.js";
import { ServiceContext } from "./handlers/index.js";
import cron from "node-cron";

async function main(): Promise<void> {
  const config = loadConfig();

  // Initialize services
  const db = new DatabaseService(config.database.path);
  const solana = new SolanaService(config.solana);
  const dca = new DcaService(db, solana, config.isDev);
  const services: ServiceContext = { db, solana, dca };

  // Start DCA scheduler in development mode
  if (config.isDev && config.dca.amountSol > 0) {
    startDcaScheduler(config.dca.timeUtc, config.dca.amountSol, dca);
  }

  // Web-only mode: just start the web server
  if (config.web?.enabled) {
    console.log("Starting DCA Bot in WEB MODE...");
    console.log("─".repeat(50));
    console.log("WEB TEST INTERFACE");
    console.log("─".repeat(50));
    console.log(`Network: ${config.solana.network}`);
    console.log(`RPC: ${config.solana.rpcUrl}`);
    console.log("─".repeat(50));

    await startWebServer(config, services);

    console.log("Press Ctrl+C to stop.\n");

    // Keep process alive
    process.on("SIGINT", () => {
      console.log("\nShutting down...");
      db.close();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      console.log("\nShutting down...");
      db.close();
      process.exit(0);
    });

    return;
  }

  // Telegram bot mode
  console.log("Starting DCA Telegram Bot...");

  const bot = createBot(config, services);

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log("\nShutting down...");
    await bot.stop();
    db.close();
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
    console.log("DEVELOPMENT MODE");
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

function startDcaScheduler(timeUtc: string, amountSol: number, dca: DcaService): void {
  const [hours, minutes] = timeUtc.split(":").map(Number);

  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    console.error(`[DCA] Invalid time format: ${timeUtc}. Expected HH:MM (e.g., 14:00)`);
    return;
  }

  // Cron expression: minute hour * * * (every day at specified time UTC)
  const cronExpression = `${minutes} ${hours} * * *`;

  console.log(`[DCA] Scheduler started: ${amountSol} SOL daily at ${timeUtc} UTC`);

  cron.schedule(cronExpression, async () => {
    console.log(`[DCA] Running scheduled purchase at ${new Date().toISOString()}`);

    try {
      const result = await dca.executeDcaForAllUsers(amountSol);
      console.log(`[DCA] Completed: ${result.successful}/${result.processed} users processed successfully`);
    } catch (error) {
      console.error("[DCA] Scheduler error:", error);
    }
  }, {
    timezone: "UTC",
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
