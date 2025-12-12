// Load .env file before any config is read
try {
  process.loadEnvFile();
} catch {
  console.log("No .env file found, using environment variables");
}

import { Kysely } from "kysely";
import { loadConfig } from "./config/index.js";
import { createMainDatabase, createMockDatabase } from "./data/datasources/KyselyDatabase.js";
import { createMainRepositories, createMockRepositories } from "./data/factories/RepositoryFactory.js";
import { SchedulerRepository } from "./domain/repositories/SchedulerRepository.js";
import { SolanaService } from "./services/solana.js";
import { DcaService } from "./services/dca.js";
import {
  WalletUseCases,
  BalanceUseCases,
  PurchaseUseCases,
  PortfolioUseCases,
  UserUseCases,
  DcaWalletUseCases,
} from "./domain/usecases/index.js";
import { ProtocolHandler, UseCases } from "./presentation/protocol/index.js";
import { createTelegramBot } from "./presentation/telegram/index.js";
import { startWebServer } from "./presentation/web/index.js";
import type { MainDatabase, MockDatabase } from "./data/types/database.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const dbMode = config.database.mode;

  console.log(`Database mode: ${dbMode}`);

  // Initialize database connections (only for sqlite mode)
  let mainDb: Kysely<MainDatabase> | undefined;
  let mockDb: Kysely<MockDatabase> | undefined;

  if (dbMode === "sqlite") {
    mainDb = createMainDatabase(config.database.path);
  }

  // Create repositories based on mode
  const { userRepository, transactionRepository } = createMainRepositories(dbMode, mainDb);

  // Ensure transaction repository schema is initialized (for sqlite)
  void transactionRepository;

  // Initialize Solana service
  const solana = new SolanaService(config.solana);

  // Initialize mock database and DCA service only in development mode
  let dca: DcaService | undefined;
  let schedulerRepository: SchedulerRepository | undefined;

  if (config.isDev) {
    if (dbMode === "sqlite") {
      mockDb = createMockDatabase(config.database.mockPath);
    }

    const mockRepos = createMockRepositories(dbMode, mockDb);
    schedulerRepository = mockRepos.schedulerRepository;

    dca = new DcaService(
      userRepository,
      mockRepos.portfolioRepository,
      mockRepos.purchaseRepository,
      solana,
      config.isDev,
    );
  }

  // Create use cases
  const useCases: UseCases = {
    wallet: new WalletUseCases(userRepository, solana),
    balance: new BalanceUseCases(userRepository, solana),
    purchase: new PurchaseUseCases(userRepository, dca),
    portfolio: new PortfolioUseCases(userRepository, dca),
    user: new UserUseCases(userRepository, dca),
    dcaWallet: new DcaWalletUseCases(userRepository, solana, config.dcaWallet),
  };

  // Create protocol handler
  const handler = new ProtocolHandler(useCases, config.isDev);

  console.log(`Command mode: ${config.isDev ? "development" : "production"} (${handler.getAvailableCommands().length} commands available)`);

  // Start DCA scheduler in development mode
  if (config.isDev && dca && schedulerRepository && config.dca.amountUsdc > 0 && config.dca.intervalMs > 0) {
    startDcaScheduler(config.dca.intervalMs, config.dca.amountUsdc, dca, schedulerRepository);
  }

  // Cleanup function
  const cleanup = async (): Promise<void> => {
    await mockDb?.destroy();
    await mainDb?.destroy();
  };

  // Web-only mode: just start the web server
  if (config.web?.enabled) {
    console.log("Starting DCA Bot in WEB MODE...");
    console.log("─".repeat(50));
    console.log("WEB TEST INTERFACE");
    console.log("─".repeat(50));
    console.log(`Network: ${config.solana.network}`);
    console.log(`RPC: ${config.solana.rpcUrl}`);
    console.log("─".repeat(50));

    await startWebServer(config.web.port ?? 3000, handler);

    console.log("Press Ctrl+C to stop.\n");

    // Keep process alive
    process.on("SIGINT", async () => {
      console.log("\nShutting down...");
      await cleanup();
      process.exit(0);
    });
    process.on("SIGTERM", async () => {
      console.log("\nShutting down...");
      await cleanup();
      process.exit(0);
    });

    return;
  }

  // Telegram bot mode
  console.log("Starting DCA Telegram Bot...");

  const bot = createTelegramBot(config.telegram.botToken, handler, config.isDev);

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log("\nShutting down...");
    await bot.stop();
    await cleanup();
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
  amountUsdc: number,
  dca: DcaService,
  schedulerRepository: SchedulerRepository,
): void {
  const formatInterval = (ms: number): string => {
    if (ms >= 86400000) return `${(ms / 86400000).toFixed(1)} days`;
    if (ms >= 3600000) return `${(ms / 3600000).toFixed(1)} hours`;
    if (ms >= 60000) return `${(ms / 60000).toFixed(1)} minutes`;
    return `${ms} ms`;
  };

  console.log(`[DCA] Persistent scheduler starting: ${amountUsdc} USDC every ${formatInterval(intervalMs)}`);

  // Initialize scheduler state in database
  schedulerRepository.initState(intervalMs).catch((error) => {
    console.error("[DCA] Failed to initialize scheduler state:", error);
  });

  const runDca = async (timestamp: Date): Promise<boolean> => {
    console.log(`[DCA] Running scheduled purchase for ${timestamp.toISOString()}`);

    try {
      const result = await dca.executeDcaForAllUsers(amountUsdc);
      console.log(`[DCA] Completed: ${result.successful}/${result.processed} users processed successfully`);

      // Update last run time after successful execution
      await schedulerRepository.updateLastRunAt(timestamp);
      return true;
    } catch (error) {
      console.error("[DCA] Scheduler error:", error);
      return false;
    }
  };

  // Schedule next run based on last_run_at + intervalMs
  const scheduleNextRun = async (): Promise<void> => {
    const state = await schedulerRepository.getState();
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
        scheduleNextRun().catch((error) => {
          console.error("[DCA] Failed to schedule next run:", error);
        });
      } else {
        // Retry after a short delay on failure
        console.log("[DCA] Retrying in 1 minute...");
        setTimeout(() => {
          scheduleNextRun().catch((error) => {
            console.error("[DCA] Failed to schedule next run:", error);
          });
        }, 60000);
      }
    }, delay);
  };

  // Catch up missed runs on startup
  const catchUpMissedRuns = async (): Promise<void> => {
    const state = await schedulerRepository.getState();
    const lastRunAt = state?.lastRunAt ? state.lastRunAt.getTime() : null;

    if (!lastRunAt) {
      console.log("[DCA] No previous run found - scheduling first run");
      await scheduleNextRun();
      return;
    }

    const now = Date.now();
    const timeSinceLastRun = now - lastRunAt;
    const missedIntervals = Math.floor(timeSinceLastRun / intervalMs);

    if (missedIntervals <= 0) {
      console.log("[DCA] No missed intervals - scheduling next run");
      await scheduleNextRun();
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
    await scheduleNextRun();
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
