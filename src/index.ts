import { loadConfig } from "./config/index.js";
import { createBot } from "./bot/index.js";
import { startWebServer } from "./web/index.js";
import { DatabaseService } from "./db/index.js";
import { MockDatabaseService } from "./db/mock.js";
import { SolanaService } from "./services/solana.js";
import { DcaService } from "./services/dca.js";
import { ServiceContext } from "./handlers/index.js";

async function main(): Promise<void> {
  const config = loadConfig();

  // Initialize services
  const db = new DatabaseService(config.database.path);
  const solana = new SolanaService(config.solana);

  // Initialize mock database and DCA service only in development mode
  let dca: DcaService | undefined;
  let mockDb: MockDatabaseService | undefined;

  if (config.isDev) {
    mockDb = new MockDatabaseService(config.database.mockPath);
    dca = new DcaService(db, mockDb, solana, config.isDev);
  }

  const services: ServiceContext = { db, solana, dca };

  // Start DCA scheduler in development mode
  if (config.isDev && dca && config.dca.amountSol > 0 && config.dca.intervalMs > 0) {
    startDcaScheduler(config.dca.intervalMs, config.dca.amountSol, dca);
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
      mockDb?.close();
      db.close();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      console.log("\nShutting down...");
      mockDb?.close();
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
    mockDb?.close();
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

function startDcaScheduler(intervalMs: number, amountSol: number, dca: DcaService): void {
  const formatInterval = (ms: number): string => {
    if (ms >= 86400000) return `${(ms / 86400000).toFixed(1)} days`;
    if (ms >= 3600000) return `${(ms / 3600000).toFixed(1)} hours`;
    if (ms >= 60000) return `${(ms / 60000).toFixed(1)} minutes`;
    return `${ms} ms`;
  };

  console.log(`[DCA] Scheduler started: ${amountSol} SOL every ${formatInterval(intervalMs)}`);

  const runDca = async (): Promise<void> => {
    console.log(`[DCA] Running scheduled purchase at ${new Date().toISOString()}`);

    try {
      const result = await dca.executeDcaForAllUsers(amountSol);
      console.log(`[DCA] Completed: ${result.successful}/${result.processed} users processed successfully`);
    } catch (error) {
      console.error("[DCA] Scheduler error:", error);
    }

    // Schedule next run
    const nextRun = Date.now() + intervalMs;
    console.log(`[DCA] Next run at ${new Date(nextRun).toISOString()}`);
  };

  // Schedule first run after interval
  setTimeout(() => {
    runDca();
    // Then run at regular intervals
    setInterval(runDca, intervalMs);
  }, intervalMs);

  const firstRun = Date.now() + intervalMs;
  console.log(`[DCA] First run scheduled at ${new Date(firstRun).toISOString()}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
