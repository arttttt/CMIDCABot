// Load .env file before any config is read
try {
  process.loadEnvFile();
} catch {
  console.log("No .env file found, using environment variables");
}

import { Kysely } from "kysely";
import { loadConfig } from "./config/index.js";
import { setLogger, DebugLogger, NoOpLogger } from "./services/logger.js";
import { createMainDatabase, createMockDatabase, createAuthDatabase } from "./data/datasources/index.js";
import { createMainRepositories, createMockRepositories } from "./data/factories/RepositoryFactory.js";
import { SQLiteAuthRepository } from "./data/repositories/sqlite/SQLiteAuthRepository.js";
import { SQLiteInviteTokenRepository } from "./data/repositories/sqlite/SQLiteInviteTokenRepository.js";
import { InMemoryAuthRepository } from "./data/repositories/memory/InMemoryAuthRepository.js";
import { InMemoryInviteTokenRepository } from "./data/repositories/memory/InMemoryInviteTokenRepository.js";
import { SolanaService } from "./services/solana.js";
import { getEncryptionService, initializeEncryption } from "./services/encryption.js";
import { AuthorizationService } from "./services/authorization.js";
import { TelegramUserResolver } from "./services/userResolver.js";
import { DcaService } from "./services/dca.js";
import { DcaScheduler } from "./services/DcaScheduler.js";
import { PriceService } from "./services/price.js";
import { JupiterSwapService } from "./services/jupiter-swap.js";
import type { AuthDatabase } from "./data/types/authDatabase.js";
import {
  InitUserUseCase,
  ExecutePurchaseUseCase,
  GetPortfolioStatusUseCase,
  WalletInfoHelper,
  ShowWalletUseCase,
  CreateWalletUseCase,
  ImportWalletUseCase,
  DeleteWalletUseCase,
  ExportWalletKeyUseCase,
  StartDcaUseCase,
  StopDcaUseCase,
  GetDcaStatusUseCase,
  GetPricesUseCase,
  GetQuoteUseCase,
  SimulateSwapUseCase,
  ExecuteSwapUseCase,
  GenerateInviteUseCase,
  ActivateInviteUseCase,
} from "./domain/usecases/index.js";
import { ProtocolHandler } from "./presentation/protocol/index.js";
import {
  DevCommandRegistry,
  ProdCommandRegistry,
  type DevCommandRegistryDeps,
  type ProdCommandRegistryDeps,
  type CommandRegistry,
} from "./presentation/commands/index.js";
import {
  DcaWalletFormatter,
  DcaFormatter,
  PortfolioFormatter,
  PurchaseFormatter,
  PriceFormatter,
  QuoteFormatter,
  SimulateFormatter,
  SwapFormatter,
  AdminFormatter,
  InviteFormatter,
} from "./presentation/formatters/index.js";
import { createTelegramBot } from "./presentation/telegram/index.js";
import { startWebServer } from "./presentation/web/index.js";
import { HealthService } from "./services/health.js";
import type { MainDatabase, MockDatabase } from "./data/types/database.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const dbMode = config.database.mode;

  // Initialize logger based on environment
  setLogger(config.isDev ? new DebugLogger() : new NoOpLogger());

  console.log(`Database mode: ${dbMode}`);

  // Initialize encryption service (required for private key protection)
  await initializeEncryption(config.encryption.masterKey);
  const encryptionService = getEncryptionService();

  // Initialize database connections (only for sqlite mode)
  let mainDb: Kysely<MainDatabase> | undefined;
  let mockDb: Kysely<MockDatabase> | undefined;
  let authDb: Kysely<AuthDatabase> | undefined;

  if (dbMode === "sqlite") {
    mainDb = createMainDatabase(config.database.path);
    authDb = createAuthDatabase(config.auth.dbPath);
  }

  // Create repositories based on mode
  const { userRepository, transactionRepository } = createMainRepositories(dbMode, encryptionService, mainDb);

  // Create auth repository
  const authRepository = dbMode === "sqlite" && authDb
    ? new SQLiteAuthRepository(authDb)
    : new InMemoryAuthRepository();

  // Create invite token repository
  const inviteTokenRepository = dbMode === "sqlite" && authDb
    ? new SQLiteInviteTokenRepository(authDb)
    : new InMemoryInviteTokenRepository();

  // Create authorization service
  const authService = new AuthorizationService(authRepository, config.auth.ownerTelegramId);
  await authService.initialize();
  console.log(`Authorization: Owner ID ${config.auth.ownerTelegramId}`);

  // Create user resolver (will be connected to bot API later)
  const userResolver = new TelegramUserResolver();

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
    encryptionService,
    config.dcaWallet.devPrivateKey,
  );

  // Create use cases
  const initUser = new InitUserUseCase(userRepository, dca);
  const showWallet = new ShowWalletUseCase(userRepository, walletHelper);
  const createWallet = new CreateWalletUseCase(userRepository, solana, walletHelper);
  const importWallet = new ImportWalletUseCase(userRepository, solana, walletHelper);
  const deleteWallet = new DeleteWalletUseCase(userRepository, walletHelper);
  const exportWalletKey = new ExportWalletKeyUseCase(userRepository, encryptionService, config.dcaWallet);
  const startDca = new StartDcaUseCase(userRepository, dcaScheduler);
  const stopDca = new StopDcaUseCase(userRepository, dcaScheduler);
  const getDcaStatus = new GetDcaStatusUseCase(userRepository, dcaScheduler);
  const getPrices = new GetPricesUseCase(dca);
  const getQuote = new GetQuoteUseCase(jupiterSwap);
  const simulateSwap = new SimulateSwapUseCase(
    jupiterSwap,
    solana,
    userRepository,
    config.dcaWallet.devPrivateKey,
  );

  // Create use cases that require Jupiter
  const executePurchase = jupiterSwap && priceService
    ? new ExecutePurchaseUseCase(
        userRepository,
        executeSwapUseCase,
        solana,
        priceService,
        config.dcaWallet.devPrivateKey,
      )
    : undefined;

  const getPortfolioStatus = priceService
    ? new GetPortfolioStatusUseCase(
        userRepository,
        solana,
        priceService,
        config.dcaWallet.devPrivateKey,
      )
    : undefined;

  // Create invite use cases
  const generateInvite = new GenerateInviteUseCase(inviteTokenRepository, authRepository);
  const activateInvite = new ActivateInviteUseCase(inviteTokenRepository, authRepository);

  // Create formatters
  const dcaWalletFormatter = new DcaWalletFormatter();
  const dcaFormatter = new DcaFormatter();
  const portfolioFormatter = new PortfolioFormatter();
  const purchaseFormatter = new PurchaseFormatter();
  const priceFormatter = new PriceFormatter();
  const quoteFormatter = new QuoteFormatter();
  const simulateFormatter = new SimulateFormatter();
  const swapFormatter = new SwapFormatter();
  const adminFormatter = new AdminFormatter();

  // Helper function to build registry and handler with optional botUsername
  function createRegistryAndHandler(botUsername?: string) {
    // Create invite formatter if botUsername is available
    const inviteFormatter = botUsername ? new InviteFormatter(botUsername) : undefined;

    // Start command deps (shared between dev and prod)
    const startDeps = {
      initUser,
      authService,
      activateInvite: inviteFormatter ? activateInvite : undefined,
      inviteFormatter,
    };

    // Admin command deps (shared between dev and prod)
    const adminDeps = {
      authService,
      formatter: adminFormatter,
      userResolver,
      generateInvite: inviteFormatter ? generateInvite : undefined,
      inviteFormatter,
    };

    // Build command registry based on mode
    let registry: CommandRegistry;

    if (config.isDev) {
      const deps: DevCommandRegistryDeps = {
        start: startDeps,
        wallet: {
          showWallet,
          createWallet,
          importWallet,
          deleteWallet,
          exportWalletKey,
          formatter: dcaWalletFormatter,
        },
        dca: {
          startDca,
          stopDca,
          getDcaStatus,
          formatter: dcaFormatter,
        },
        portfolio: {
          getPortfolioStatus,
          executePurchase,
          portfolioFormatter,
          purchaseFormatter,
        },
        prices: {
          getPrices,
          formatter: priceFormatter,
        },
        swap: {
          getQuote,
          simulateSwap,
          executeSwap: executeSwapUseCase,
          quoteFormatter,
          simulateFormatter,
          swapFormatter,
        },
        admin: adminDeps,
      };
      registry = new DevCommandRegistry(deps);
    } else {
      const deps: ProdCommandRegistryDeps = {
        start: startDeps,
        wallet: {
          showWallet,
          createWallet,
          importWallet,
          deleteWallet,
          exportWalletKey,
          formatter: dcaWalletFormatter,
        },
        portfolio: {
          getPortfolioStatus,
          executePurchase,
          portfolioFormatter,
          purchaseFormatter,
        },
        admin: adminDeps,
      };
      registry = new ProdCommandRegistry(deps);
    }

    // Create protocol handler
    const handler = new ProtocolHandler(registry, authService);

    return { registry, handler };
  }

  // Cleanup function
  const cleanup = async (): Promise<void> => {
    dcaScheduler?.stop();
    await mockDb?.destroy();
    await mainDb?.destroy();
    await authDb?.destroy();
  };

  // Web-only mode: just start the web server
  if (config.web?.enabled) {
    // Block web server in production mode for security
    if (!config.isDev) {
      console.warn("─".repeat(50));
      console.warn("WARNING: Web interface is disabled in production mode!");
      console.warn("The web interface is intended for local development only.");
      console.warn("Set NODE_ENV=development or disable WEB_ENABLED to proceed.");
      console.warn("─".repeat(50));
      process.exit(1);
    }

    // Create handler without botUsername (invite links won't work in web mode)
    const { handler } = createRegistryAndHandler();

    console.log("Starting DCA Bot in WEB MODE...");
    console.log("─".repeat(50));
    console.log("WEB TEST INTERFACE");
    console.log("─".repeat(50));
    console.log(`RPC: ${maskUrl(config.solana.rpcUrl)}`);
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

  // Start health check server in production for platforms like Koyeb
  let healthService: HealthService | undefined;
  if (!config.isDev) {
    const healthPort = Number(process.env.PORT) || 8000;
    healthService = new HealthService({ port: healthPort });
    healthService.start();
  }

  // Get bot info first to have botUsername for invite links
  const { Bot } = await import("grammy");
  const tempBot = new Bot(config.telegram.botToken);
  const botInfo = await tempBot.api.getMe();

  // Create handler with botUsername (single creation, no recreation)
  const { registry, handler } = createRegistryAndHandler(botInfo.username);

  const modeInfo = registry.getModeInfo();
  const modeLabel = modeInfo?.label ?? "Production";
  console.log(`Command mode: ${modeLabel} (${handler.getAvailableCommands().length} commands available)`);

  // Create the bot with the handler
  const bot = createTelegramBot(config.telegram.botToken, handler, config.isDev);

  // Connect user resolver to bot API for username resolution
  userResolver.setApi(bot.api);

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log("\nShutting down...");
    healthService?.stop();
    try {
      // Close bot session to release getUpdates lock
      await bot.api.close();
    } catch {
      // Ignore close errors
    }
    await bot.stop();
    await cleanup();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Delete any existing webhook to ensure polling works
  await bot.api.deleteWebhook({ drop_pending_updates: true });

  if (config.isDev) {
    console.log("─".repeat(50));
    console.log("DEVELOPMENT MODE");
    console.log("─".repeat(50));
    console.log(`Bot: @${botInfo.username}`);
    console.log(`RPC: ${maskUrl(config.solana.rpcUrl)}`);
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
    console.log(`RPC: ${maskUrl(config.solana.rpcUrl)}`);
  }

  // Start bot with retry on 409 Conflict
  const maxRetries = 5;
  const baseDelayMs = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await bot.start({
        onStart: (botInfo) => {
          if (!config.isDev) {
            console.log(`Bot @${botInfo.username} is running`);
          }
        },
      });
      break; // Success, exit retry loop
    } catch (error) {
      const is409 = error instanceof Error &&
        error.message.includes("409") &&
        error.message.includes("Conflict");

      if (is409 && attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`Bot instance conflict detected (attempt ${attempt}/${maxRetries}), retrying in ${delayMs / 1000}s...`);

        await new Promise((resolve) => setTimeout(resolve, delayMs));

        // Try to release any existing session
        try {
          await bot.api.close();
        } catch {
          // Ignore
        }
        await bot.api.deleteWebhook({ drop_pending_updates: true });
      } else {
        throw error;
      }
    }
  }
}

function formatInterval(ms: number): string {
  if (ms >= 86400000) return `${(ms / 86400000).toFixed(1)} days`;
  if (ms >= 3600000) return `${(ms / 3600000).toFixed(1)} hours`;
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)} minutes`;
  return `${ms} ms`;
}

function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.search) {
      parsed.search = "?***";
    }
    return parsed.toString();
  } catch {
    return url.replace(/[?].*$/, "?***");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
