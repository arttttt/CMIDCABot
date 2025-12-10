// Load .env file before any config is read
try {
  process.loadEnvFile();
} catch {
  console.log("No .env file found, using environment variables");
}

import { loadConfig } from "./config/index.js";
import { createBot } from "./bot/index.js";
import { startWebServer } from "./web/index.js";
import { SQLiteDatabase } from "./data/datasources/SQLiteDatabase.js";
import { SQLiteUserRepository } from "./data/repositories/sqlite/SQLiteUserRepository.js";
import { SQLiteTransactionRepository } from "./data/repositories/sqlite/SQLiteTransactionRepository.js";
import { SQLitePortfolioRepository } from "./data/repositories/sqlite/SQLitePortfolioRepository.js";
import { SQLiteMockPurchaseRepository } from "./data/repositories/sqlite/SQLiteMockPurchaseRepository.js";
import { SQLiteSchedulerRepository } from "./data/repositories/sqlite/SQLiteSchedulerRepository.js";
import { SchedulerRepository } from "./data/repositories/interfaces/SchedulerRepository.js";
import { SolanaService } from "./services/solana.js";
import { DcaService } from "./services/dca.js";
import { ServiceContext } from "./handlers/index.js";
import { createCommandMode } from "./commands/index.js";

async function main(): Promise<void> {
  const config = loadConfig();

  // Initialize database connections
  const mainDb = new SQLiteDatabase(config.database.path);

  // Initialize repositories for main database
  const userRepository = new SQLiteUserRepository(mainDb);
  new SQLiteTransactionRepository(mainDb); // Initialize schema

  // Initialize Solana service
  const solana = new SolanaService(config.solana);

  // Initialize mock database and DCA service only in development mode
  let dca: DcaService | undefined;
  let mockDb: SQLiteDatabase | undefined;
  let schedulerRepository: SchedulerRepository | undefined;

  if (config.isDev) {
    mockDb = new SQLiteDatabase(config.database.mockPath);

    // Initialize repositories for mock database
    const portfolioRepository = new SQLitePortfolioRepository(mockDb);
    const mockPurchaseRepository = new SQLiteMockPurchaseRepository(mockDb);
    schedulerRepository = new SQLiteSchedulerRepository(mockDb);

    dca = new DcaService(
      userRepository,
      portfolioRepository,
      mockPurchaseRepository,
      solana,
      config.isDev,
    );
  }

  const services: ServiceContext = { userRepository, solana, dca };

  // Create command mode based on environment
  const commandMode = createCommandMode(config.isDev);
  console.log(`Command mode: ${config.isDev ? "development" : "production"} (${commandMode.getCommands().length} commands available)`);

  // Start DCA scheduler in development mode
  if (config.isDev && dca && schedulerRepository && config.dca.amountSol > 0 && config.dca.intervalMs > 0) {
    startDcaScheduler(config.dca.intervalMs, config.dca.amountSol, dca, schedulerRepository);
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

    await startWebServer(config, services, commandMode);

    console.log("Press Ctrl+C to stop.\n");

    // Keep process alive
    process.on("SIGINT", () => {
      console.log("\nShutting down...");
      mockDb?.close();
      mainDb.close();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      console.log("\nShutting down...");
      mockDb?.close();
      mainDb.close();
      process.exit(0);
    });

    return;
  }

  // Telegram bot mode
  console.log("Starting DCA Telegram Bot...");

  const bot = createBot(config, services, commandMode);

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log("\nShutting down...");
    await bot.stop();
    mockDb?.close();
    mainDb.close();
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

function startDcaScheduler(
  intervalMs: number,
  amountSol: number,
  dca: DcaService,
  schedulerRepository: SchedulerRepository,
): void {
  const formatInterval = (ms: number): string => {
    if (ms >= 86400000) return `${(ms / 86400000).toFixed(1)} days`;
    if (ms >= 3600000) return `${(ms / 3600000).toFixed(1)} hours`;
    if (ms >= 60000) return `${(ms / 60000).toFixed(1)} minutes`;
    return `${ms} ms`;
  };

  console.log(`[DCA] Persistent scheduler starting: ${amountSol} SOL every ${formatInterval(intervalMs)}`);

  // Initialize scheduler state in database
  schedulerRepository.initState(intervalMs);

  const runDca = async (timestamp: Date): Promise<boolean> => {
    console.log(`[DCA] Running scheduled purchase for ${timestamp.toISOString()}`);

    try {
      const result = await dca.executeDcaForAllUsers(amountSol);
      console.log(`[DCA] Completed: ${result.successful}/${result.processed} users processed successfully`);

      // Update last run time after successful execution
      schedulerRepository.updateLastRunAt(timestamp);
      return true;
    } catch (error) {
      console.error("[DCA] Scheduler error:", error);
      return false;
    }
  };

  // Schedule next run based on last_run_at + intervalMs
  const scheduleNextRun = (): void => {
    const state = schedulerRepository.getState();
    const lastRunAt = state?.lastRunAt ? state.lastRunAt.getTime() : null;

    let nextRunTime: number;
    if (lastRunAt) {
      // Next run = last successful run + interval
      nextRunTime = lastRunAt + intervalMs;
    } else {
      // No previous run - schedule for now + interval
      nextRunTime = Date.now() + intervalMs;
    }

    const delay = Math.max(0, nextRunTime - Date.now());
    console.log(`[DCA] Next run scheduled at ${new Date(nextRunTime).toISOString()} (in ${formatInterval(delay)})`);

    setTimeout(async () => {
      const success = await runDca(new Date());
      if (success) {
        // Schedule next run after successful execution
        scheduleNextRun();
      } else {
        // Retry after a short delay on failure
        console.log("[DCA] Retrying in 1 minute...");
        setTimeout(scheduleNextRun, 60000);
      }
    }, delay);
  };

  // Catch up missed runs on startup
  const catchUpMissedRuns = async (): Promise<void> => {
    const state = schedulerRepository.getState();
    const lastRunAt = state?.lastRunAt ? state.lastRunAt.getTime() : null;

    if (!lastRunAt) {
      console.log("[DCA] No previous run found - scheduling first run");
      scheduleNextRun();
      return;
    }

    const now = Date.now();
    const timeSinceLastRun = now - lastRunAt;
    const missedIntervals = Math.floor(timeSinceLastRun / intervalMs);

    if (missedIntervals <= 0) {
      console.log("[DCA] No missed intervals - scheduling next run");
      scheduleNextRun();
      return;
    }

    console.log(`[DCA] Detected ${missedIntervals} missed interval(s) - catching up...`);

    // Execute each missed interval
    for (let i = 1; i <= missedIntervals; i++) {
      const missedTimestamp = new Date(lastRunAt + i * intervalMs);
      console.log(`[DCA] Catching up missed run ${i}/${missedIntervals}`);
      const success = await runDca(missedTimestamp);
      if (!success) {
        console.error(`[DCA] Failed to catch up run ${i} - stopping catch-up`);
        break;
      }
    }

    console.log("[DCA] Catch-up complete - scheduling next run");
    scheduleNextRun();
  };

  // Start the scheduler
  catchUpMissedRuns().catch((error) => {
    console.error("[DCA] Fatal scheduler error:", error);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
