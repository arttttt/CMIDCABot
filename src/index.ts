// Load .env file before any config is read
try {
  process.loadEnvFile();
} catch {
  console.log("No .env file found, using environment variables");
}

import { Kysely } from "kysely";
import { loadConfig } from "./config/index.js";
import { setLogger, DebugLogger, NoOpLogger } from "./services/logger.js";
import { createMainDatabase, createMockDatabase } from "./data/datasources/KyselyDatabase.js";
import { createMainRepositories, createMockRepositories } from "./data/factories/RepositoryFactory.js";
import { SolanaService } from "./services/solana.js";
import { DcaService } from "./services/dca.js";
import { DcaScheduler } from "./services/DcaScheduler.js";
import { PriceService } from "./services/price.js";
import { JupiterSwapService } from "./services/jupiter-swap.js";
import {
  InitUserUseCase,
  ExecutePurchaseUseCase,
  GetPortfolioStatusUseCase,
  WalletInfoHelper,
  ShowWalletUseCase,
  CreateWalletUseCase,
  DeleteWalletUseCase,
  ExportWalletKeyUseCase,
  StartDcaUseCase,
  StopDcaUseCase,
  GetDcaStatusUseCase,
  GetPricesUseCase,
  GetQuoteUseCase,
  SimulateSwapUseCase,
  ExecuteSwapUseCase,
} from "./domain/usecases/index.js";
import { ProtocolHandler, UseCases } from "./presentation/protocol/index.js";
import { createTelegramBot } from "./presentation/telegram/index.js";
import { startWebServer } from "./presentation/web/index.js";
import type { MainDatabase, MockDatabase } from "./data/types/database.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const dbMode = config.database.mode;

  // Initialize logger based on environment
  setLogger(config.isDev ? new DebugLogger() : new NoOpLogger());

  console.log(`Database mode: ${dbMode}`);

  // Initialize database connections (only for sqlite mode)
  let mainDb: Kysely<MainDatabase> | undefined;
  let mockDb: Kysely<MockDatabase> | undefined;

  if (dbMode === "sqlite") {
    mainDb = createMainDatabase(config.database.path);
  }

  // Create repositories based on mode
  const { userRepository, transactionRepository } = createMainRepositories(dbMode, mainDb);

  // Initialize Solana service
  const solana = new SolanaService(config.solana);

  // Initialize PriceService (required for portfolio and swap operations)
  let priceService: PriceService | undefined;

  if (config.price.jupiterApiKey) {
    priceService = new PriceService(config.price.jupiterApiKey);
  }

  // Initialize JupiterSwapService (for quote/swap operations, requires API key)
  let jupiterSwap: JupiterSwapService | undefined;

  if (config.price.jupiterApiKey) {
    jupiterSwap = new JupiterSwapService(config.price.jupiterApiKey);
  }

  // Initialize mock database, DCA service and scheduler only in development mode
  let dca: DcaService | undefined;
  let dcaScheduler: DcaScheduler | undefined;

  if (config.isDev) {
    if (dbMode === "sqlite") {
      mockDb = createMockDatabase(config.database.mockPath);
    }

    const mockRepos = createMockRepositories(dbMode, mockDb);

    dca = new DcaService(
      userRepository,
      mockRepos.portfolioRepository,
      mockRepos.purchaseRepository,
      solana,
      config.isDev,
      config.price.source,
      priceService,
    );

    // Create DCA scheduler if configured
    if (config.dca.amountUsdc > 0 && config.dca.intervalMs > 0) {
      dcaScheduler = new DcaScheduler(
        userRepository,
        mockRepos.schedulerRepository,
        dca,
        {
          intervalMs: config.dca.intervalMs,
          amountUsdc: config.dca.amountUsdc,
        },
      );

      // Try to start scheduler if there are already active users
      dcaScheduler.start().catch((error) => {
        console.error("[DCA Scheduler] Failed to check for active users:", error);
      });
    }
  }

  // Create helpers
  const walletHelper = new WalletInfoHelper(solana, config.dcaWallet);

  // Create ExecuteSwapUseCase first (used by ExecutePurchaseUseCase)
  const executeSwapUseCase = new ExecuteSwapUseCase(
    jupiterSwap,
    solana,
    userRepository,
    transactionRepository,
    config.dcaWallet.devPrivateKey,
  );

  // Create use cases
  const useCases: UseCases = {
    // User
    initUser: new InitUserUseCase(userRepository, dca),
    // Purchase (requires Jupiter for real swaps)
    executePurchase: jupiterSwap && priceService
      ? new ExecutePurchaseUseCase(
          userRepository,
          executeSwapUseCase,
          solana,
          priceService,
          config.dcaWallet.devPrivateKey,
        )
      : (undefined as unknown as ExecutePurchaseUseCase),
    // Portfolio (requires PriceService)
    getPortfolioStatus: priceService
      ? new GetPortfolioStatusUseCase(
          userRepository,
          solana,
          priceService,
          config.dcaWallet.devPrivateKey,
        )
      : (undefined as unknown as GetPortfolioStatusUseCase),
    // Wallet
    showWallet: new ShowWalletUseCase(userRepository, walletHelper),
    createWallet: new CreateWalletUseCase(userRepository, solana, walletHelper),
    deleteWallet: new DeleteWalletUseCase(userRepository, walletHelper),
    exportWalletKey: new ExportWalletKeyUseCase(userRepository, config.dcaWallet),
    // DCA
    startDca: new StartDcaUseCase(userRepository, dcaScheduler),
    stopDca: new StopDcaUseCase(userRepository, dcaScheduler),
    getDcaStatus: new GetDcaStatusUseCase(userRepository, dcaScheduler),
    // Prices
    getPrices: new GetPricesUseCase(dca),
    // Quote
    getQuote: new GetQuoteUseCase(jupiterSwap),
    // Simulate
    simulateSwap: new SimulateSwapUseCase(
      jupiterSwap,
      solana,
      userRepository,
      config.dcaWallet.devPrivateKey,
    ),
    // Swap
    executeSwap: executeSwapUseCase,
  };

  // Create protocol handler
  const handler = new ProtocolHandler(useCases, config.isDev);

  console.log(`Command mode: ${config.isDev ? "development" : "production"} (${handler.getAvailableCommands().length} commands available)`);

  // Cleanup function
  const cleanup = async (): Promise<void> => {
    dcaScheduler?.stop();
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

  // Delete any existing webhook to ensure polling works
  await bot.api.deleteWebhook({ drop_pending_updates: true });

  if (config.isDev) {
    console.log("─".repeat(50));
    console.log("DEVELOPMENT MODE");
    console.log("─".repeat(50));
    console.log(`Bot: @${botInfo.username}`);
    console.log(`Network: ${config.solana.network}`);
    console.log(`RPC: ${config.solana.rpcUrl}`);
    console.log(`Mode: Long Polling (local)`);
    if (dcaScheduler) {
      console.log(`DCA: ${config.dca.amountUsdc} USDC every ${formatInterval(config.dca.intervalMs)}`);
    }
    console.log(`Prices: ${config.price.source === "jupiter" ? "Jupiter API (real-time)" : "Mock (static)"}`)
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

function formatInterval(ms: number): string {
  if (ms >= 86400000) return `${(ms / 86400000).toFixed(1)} days`;
  if (ms >= 3600000) return `${(ms / 3600000).toFixed(1)} hours`;
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)} minutes`;
  return `${ms} ms`;
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
