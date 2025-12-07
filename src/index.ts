import { loadConfig } from "./config/index.js";
import { createBot } from "./bot/index.js";
import { startWebServer } from "./web/index.js";
import { DatabaseService } from "./db/index.js";
import { MockDatabaseService } from "./db/mock.js";
import { SolanaService } from "./services/solana.js";
import { DcaService } from "./services/dca.js";
import { ServiceContext } from "./handlers/index.js";
import cron from "node-cron";

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
  if (config.isDev && dca && mockDb && config.dca.amountSol > 0) {
    startDcaScheduler(config.dca.cronSchedule, config.dca.intervalMs, config.dca.amountSol, dca, mockDb);
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

function startDcaScheduler(
  cronSchedule: string,
  intervalMs: number,
  amountSol: number,
  dca: DcaService,
  mockDb: MockDatabaseService,
): void {
  // Validate cron expression
  if (!cron.validate(cronSchedule)) {
    console.error(`[DCA] Invalid cron expression: ${cronSchedule}`);
    return;
  }

  console.log(`[DCA] Persistent cron scheduler starting: ${amountSol} SOL on schedule "${cronSchedule}"`);

  // Initialize scheduler state in database
  mockDb.initSchedulerState(cronSchedule, intervalMs);
  const state = mockDb.getSchedulerState();

  const runDca = async (timestamp: Date): Promise<boolean> => {
    console.log(`[DCA] Running scheduled purchase for ${timestamp.toISOString()}`);

    try {
      const result = await dca.executeDcaForAllUsers(amountSol);
      console.log(`[DCA] Completed: ${result.successful}/${result.processed} users processed successfully`);

      // Update last run time after successful execution
      mockDb.updateLastRunAt(timestamp.toISOString());
      return true;
    } catch (error) {
      console.error("[DCA] Scheduler error:", error);
      return false;
    }
  };

  // Calculate and execute missed intervals on startup
  const catchUpMissedRuns = async (): Promise<void> => {
    const lastRunAt = state?.lastRunAt ? new Date(state.lastRunAt).getTime() : null;

    if (!lastRunAt) {
      console.log("[DCA] No previous run found - will start on next cron trigger");
      return;
    }

    const now = Date.now();
    const timeSinceLastRun = now - lastRunAt;
    const missedIntervals = Math.floor(timeSinceLastRun / intervalMs);

    if (missedIntervals <= 0) {
      console.log("[DCA] No missed intervals - cron job active");
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

    console.log("[DCA] Catch-up complete - cron job will handle future runs");
  };

  // Start the cron job (runs in UTC by default)
  cron.schedule(
    cronSchedule,
    async () => {
      await runDca(new Date());
    },
    {
      timezone: "UTC",
    },
  );

  console.log(`[DCA] Cron job scheduled (UTC): ${cronSchedule}`);

  // Catch up missed runs on startup, then let cron handle future runs
  catchUpMissedRuns().catch((error) => {
    console.error("[DCA] Fatal scheduler error during catch-up:", error);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
