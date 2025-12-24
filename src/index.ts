// Load .env file before any config is read
try {
  process.loadEnvFile();
} catch {
  console.log("No .env file found, using environment variables");
}

import { createRequire } from "module";
import { Kysely } from "kysely";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };
import { loadConfig } from "./infrastructure/shared/config/index.js";
import { setLogger, DebugLogger, NoOpLogger } from "./infrastructure/shared/logging/index.js";
import { createMainDatabase, createAuthDatabase } from "./data/sources/database/index.js";
import { createRepositories } from "./data/factories/RepositoryFactory.js";
import { SQLiteAuthRepository } from "./data/repositories/sqlite/SQLiteAuthRepository.js";
import { SQLiteInviteTokenRepository } from "./data/repositories/sqlite/SQLiteInviteTokenRepository.js";
import { InMemoryAuthRepository } from "./data/repositories/memory/InMemoryAuthRepository.js";
import { InMemoryInviteTokenRepository } from "./data/repositories/memory/InMemoryInviteTokenRepository.js";
import { CachedBalanceRepository } from "./data/repositories/memory/CachedBalanceRepository.js";
import { SolanaBlockchainRepository } from "./data/repositories/SolanaBlockchainRepository.js";
import { JupiterPriceRepository } from "./data/repositories/JupiterPriceRepository.js";
import { JupiterSwapRepository } from "./data/repositories/JupiterSwapRepository.js";
import { SolanaRpcClient } from "./data/sources/api/SolanaRpcClient.js";
import { JupiterPriceClient } from "./data/sources/api/JupiterPriceClient.js";
import { JupiterSwapClient } from "./data/sources/api/JupiterSwapClient.js";
import { KeyEncryptionService } from "./infrastructure/internal/crypto/index.js";
import { TelegramUserResolver } from "./presentation/telegram/UserResolver.js";
import { DcaScheduler } from "./_wip/dca-scheduling/index.js";
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
  DeleteUserDataUseCase,
  InitializeAuthorizationUseCase,
  AddAuthorizedUserUseCase,
  RemoveAuthorizedUserUseCase,
  GetAllAuthorizedUsersUseCase,
  UpdateUserRoleUseCase,
  ExecuteMockPurchaseUseCase,
  ExecuteBatchDcaUseCase,
  AuthorizationHelper,
} from "./domain/usecases/index.js";
import type { ImportSessionRepository } from "./domain/repositories/index.js";
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
  ProgressFormatter,
} from "./presentation/formatters/index.js";
import {
  createTelegramBot,
  createTransport,
  validateTransportConfig,
  type BotTransport,
  type TransportConfig as TelegramTransportConfig,
} from "./presentation/telegram/index.js";
import { startWebServer } from "./presentation/web/index.js";
import { HttpServer } from "./infrastructure/shared/http/index.js";
import { SecretCache, ImportSessionCache } from "./data/sources/memory/index.js";
import { InMemorySecretRepository, InMemoryImportSessionRepository } from "./data/repositories/memory/index.js";
import { CleanupScheduler } from "./infrastructure/shared/scheduling/index.js";
import { SecretPageHandler } from "./presentation/web/SecretPageHandler.js";
import { ImportPageHandler } from "./presentation/web/ImportPageHandler.js";
import { TelegramMessageSender } from "./presentation/telegram/TelegramMessageSender.js";
import type { MainDatabase } from "./data/types/database.js";

async function main(): Promise<void> {
  console.log(`CMI DCA Bot v${pkg.version}`);

  const config = loadConfig();
  const dbMode = config.database.mode;

  // Initialize logger based on environment
  setLogger(config.isDev ? new DebugLogger() : new NoOpLogger());

  console.log(`Database mode: ${dbMode}`);

  // Initialize encryption service (required for private key protection)
  const encryptionService = new KeyEncryptionService();
  await encryptionService.initialize(config.encryption.masterKey);

  // Initialize database connections (only for sqlite mode)
  let mainDb: Kysely<MainDatabase> | undefined;
  let authDb: Kysely<AuthDatabase> | undefined;

  if (dbMode === "sqlite") {
    mainDb = createMainDatabase(config.database.path);
    authDb = createAuthDatabase(config.auth.dbPath);
  }

  // Create all repositories based on mode
  const {
    userRepository,
    transactionRepository,
    portfolioRepository,
    purchaseRepository,
    schedulerRepository,
  } = createRepositories(dbMode, encryptionService, mainDb);

  // Create auth repository
  const authRepository = dbMode === "sqlite" && authDb
    ? new SQLiteAuthRepository(authDb)
    : new InMemoryAuthRepository();

  // Create invite token repository
  const inviteTokenRepository = dbMode === "sqlite" && authDb
    ? new SQLiteInviteTokenRepository(authDb)
    : new InMemoryInviteTokenRepository();

  // Create authorization helper and initialize owner
  const authHelper = new AuthorizationHelper(authRepository, config.auth.ownerTelegramId);
  const initializeAuth = new InitializeAuthorizationUseCase(authRepository, config.auth.ownerTelegramId);
  await initializeAuth.execute();

  // Create user resolver (will be connected to bot API later)
  const userResolver = new TelegramUserResolver();

  // Initialize Solana RPC client and blockchain repository
  const solanaRpcClient = new SolanaRpcClient(config.solana, encryptionService);
  const blockchainRepository = new SolanaBlockchainRepository(solanaRpcClient);

  // Initialize balance repository with caching (still uses RPC client internally)
  const balanceRepository = new CachedBalanceRepository(solanaRpcClient);

  // Initialize SecretCache for one-time secret links
  const secretCache = new SecretCache(encryptionService, {
    publicUrl: config.http.publicUrl,
  });
  const secretStore = new InMemorySecretRepository(secretCache);

  // Initialize ImportSessionCache for secure wallet import
  const importSessionCache = new ImportSessionCache({
    publicUrl: config.http.publicUrl,
  });
  const importSessionStore = new InMemoryImportSessionRepository(importSessionCache);

  // Start cleanup scheduler for expired secrets and import sessions
  const cleanupScheduler = new CleanupScheduler([secretCache, importSessionCache]);
  cleanupScheduler.start();

  // Initialize Price and Swap repositories (require API key)
  let priceRepository: JupiterPriceRepository | undefined;
  let swapRepository: JupiterSwapRepository | undefined;

  if (config.price.jupiterApiKey) {
    const jupiterPriceClient = new JupiterPriceClient(config.price.jupiterApiKey);
    priceRepository = new JupiterPriceRepository(jupiterPriceClient);

    const jupiterSwapClient = new JupiterSwapClient(config.price.jupiterApiKey);
    swapRepository = new JupiterSwapRepository(jupiterSwapClient);
  }

  // Create authorization use cases
  const addAuthorizedUser = new AddAuthorizedUserUseCase(authRepository, authHelper);
  const removeAuthorizedUser = new RemoveAuthorizedUserUseCase(authRepository, authHelper);
  const getAllAuthorizedUsers = new GetAllAuthorizedUsersUseCase(authRepository);
  const updateUserRole = new UpdateUserRoleUseCase(authRepository, authHelper);

  // Initialize scheduler only in development mode
  let dcaScheduler: DcaScheduler | undefined;

  // Create delete user data use case with all repositories
  const deleteUserData = new DeleteUserDataUseCase(
    removeAuthorizedUser,
    userRepository,
    transactionRepository,
    portfolioRepository,
    purchaseRepository,
    mainDb,
  );

  if (config.isDev) {
    // Create DCA scheduler if configured (requires price repository)
    if (config.dca.amountUsdc > 0 && config.dca.intervalMs > 0 && priceRepository) {
      // Create mock purchase use case for scheduler
      const executeMockPurchase = new ExecuteMockPurchaseUseCase(
        portfolioRepository,
        purchaseRepository,
        priceRepository,
      );

      // Create batch DCA use case for scheduler
      const executeBatchDca = new ExecuteBatchDcaUseCase(
        userRepository,
        balanceRepository,
        priceRepository,
        executeMockPurchase,
      );

      dcaScheduler = new DcaScheduler(
        userRepository,
        schedulerRepository,
        executeBatchDca,
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
  const walletHelper = new WalletInfoHelper(blockchainRepository, config.dcaWallet);

  // Create ExecuteSwapUseCase first (used by ExecutePurchaseUseCase)
  const executeSwapUseCase = new ExecuteSwapUseCase(
    swapRepository,
    blockchainRepository,
    userRepository,
    transactionRepository,
    balanceRepository,
    config.dcaWallet.devPrivateKey,
  );

  // Create use cases
  const initUser = new InitUserUseCase(userRepository, portfolioRepository);
  const showWallet = new ShowWalletUseCase(userRepository, walletHelper);
  const createWallet = new CreateWalletUseCase(userRepository, blockchainRepository, walletHelper, secretStore);
  const importWallet = new ImportWalletUseCase(userRepository, blockchainRepository, walletHelper);
  const deleteWallet = new DeleteWalletUseCase(userRepository, walletHelper);
  const exportWalletKey = new ExportWalletKeyUseCase(userRepository, secretStore, config.dcaWallet);
  const startDca = new StartDcaUseCase(userRepository, dcaScheduler);
  const stopDca = new StopDcaUseCase(userRepository, dcaScheduler);
  const getDcaStatus = new GetDcaStatusUseCase(userRepository, dcaScheduler);
  const getPrices = new GetPricesUseCase(priceRepository);
  const getQuote = new GetQuoteUseCase(swapRepository);
  const simulateSwap = new SimulateSwapUseCase(
    swapRepository,
    blockchainRepository,
    userRepository,
    config.dcaWallet.devPrivateKey,
  );

  // Create use cases that require Jupiter repositories
  const executePurchase = swapRepository && priceRepository
    ? new ExecutePurchaseUseCase(
        userRepository,
        balanceRepository,
        executeSwapUseCase,
        blockchainRepository,
        priceRepository,
        config.dcaWallet.devPrivateKey,
      )
    : undefined;

  const getPortfolioStatus = priceRepository
    ? new GetPortfolioStatusUseCase(
        userRepository,
        balanceRepository,
        blockchainRepository,
        priceRepository,
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
  const progressFormatter = new ProgressFormatter();

  // Helper function to build registry and handler
  function createRegistryAndHandler(withImportSession: ImportSessionRepository, botUsername?: string) {
    // Create invite formatter if botUsername is available
    const inviteFormatter = botUsername ? new InviteFormatter(botUsername) : undefined;

    // Start command deps (shared between dev and prod)
    const startDeps = {
      initUser,
      authHelper,
      activateInvite: inviteFormatter ? activateInvite : undefined,
      inviteFormatter,
    };

    // Admin command deps (shared between dev and prod)
    const adminDeps = {
      addAuthorizedUser,
      getAllAuthorizedUsers,
      updateUserRole,
      formatter: adminFormatter,
      userResolver,
      deleteUserData,
      version: pkg.version,
      generateInvite: inviteFormatter ? generateInvite : undefined,
      inviteFormatter,
    };

    // Version command deps (shared between dev and prod)
    const versionDeps = {
      version: pkg.version,
      formatter: adminFormatter,
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
          importSessionStore: withImportSession,
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
          progressFormatter,
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
          progressFormatter,
        },
        admin: adminDeps,
        version: versionDeps,
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
          importSessionStore: withImportSession,
        },
        portfolio: {
          getPortfolioStatus,
          executePurchase,
          portfolioFormatter,
          purchaseFormatter,
          progressFormatter,
        },
        admin: adminDeps,
        version: versionDeps,
      };
      registry = new ProdCommandRegistry(deps);
    }

    // Create protocol handler
    const handler = new ProtocolHandler(registry, authHelper);

    return { registry, handler };
  }

  // Cleanup function
  const cleanup = async (): Promise<void> => {
    cleanupScheduler.stop();
    dcaScheduler?.stop();
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
    const { handler } = createRegistryAndHandler(importSessionStore);

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

  // Get bot info first to have botUsername for invite links and API for message sending
  const { Bot } = await import("grammy");
  const tempBot = new Bot(config.telegram.botToken);
  const botInfo = await tempBot.api.getMe();

  // Create message sender for notifications from HTTP handlers
  const messageSender = new TelegramMessageSender(tempBot.api);

  // Create HTTP page handlers (shared between polling and webhook modes)
  const secretPageHandler = new SecretPageHandler(secretStore);
  const importPageHandler = new ImportPageHandler(
    importSessionStore,
    importWallet,
    messageSender,
  );

  // Build transport configuration
  const transportConfig: TelegramTransportConfig = {
    mode: config.transport.mode,
    webhook: config.transport.mode === "webhook" && config.transport.webhookUrl
      ? {
          url: config.transport.webhookUrl,
          secret: config.transport.webhookSecret,
          port: config.http.port,
          host: config.http.host,
          handlers: [secretPageHandler, importPageHandler],
        }
      : undefined,
  };

  // Validate transport configuration
  validateTransportConfig(transportConfig);

  // Start HTTP server for polling mode (webhook mode has its own server with handlers)
  let httpServer: HttpServer | undefined;

  if (config.transport.mode === "polling") {
    httpServer = new HttpServer(config.http);
    httpServer.addHandler(secretPageHandler);
    httpServer.addHandler(importPageHandler);
    httpServer.start();
  }

  // Create handler with importSessionStore and botUsername
  const { registry, handler } = createRegistryAndHandler(importSessionStore, botInfo.username);

  const modeInfo = registry.getModeInfo();
  const modeLabel = modeInfo?.label ?? "Production";
  console.log(`Command mode: ${modeLabel} (${handler.getAvailableCommands().length} commands available)`);

  // Create the bot with the handler
  const bot = createTelegramBot(config.telegram.botToken, handler, config.isDev);

  // Connect user resolver to bot API for username resolution
  userResolver.setApi(bot.api);

  // Create transport based on configuration
  let transport: BotTransport;
  transport = createTransport(transportConfig, {
    bot,
    isDev: config.isDev,
    onStart: (info) => {
      if (!config.isDev) {
        console.log(`Bot @${info.username} is running`);
      }
    },
  });

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log("\nShutting down...");
    httpServer?.stop();
    await transport.stop();
    await cleanup();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Log startup info
  const transportModeLabel = config.transport.mode === "webhook" ? "Webhook" : "Long Polling";

  if (config.isDev) {
    console.log("─".repeat(50));
    console.log("DEVELOPMENT MODE");
    console.log("─".repeat(50));
    console.log(`Bot: @${botInfo.username}`);
    console.log(`RPC: ${maskUrl(config.solana.rpcUrl)}`);
    console.log(`Mode: ${transportModeLabel}`);
    if (dcaScheduler) {
      console.log(`DCA: ${config.dca.amountUsdc} USDC every ${formatInterval(config.dca.intervalMs)}`);
    }
    console.log(`Prices: ${config.price.source === "jupiter" ? "Jupiter API (real-time)" : "Mock (static)"}`);
    console.log(`Secret links: ${config.http.publicUrl}/secret/{token}`);
    console.log(`Import links: ${config.http.publicUrl}/import/{token}`);
    console.log("─".repeat(50));
    console.log("Bot is ready! Send /start in Telegram to test.");
    console.log("Press Ctrl+C to stop.\n");
  } else {
    console.log(`Bot @${botInfo.username} starting...`);
    console.log(`RPC: ${maskUrl(config.solana.rpcUrl)}`);
    console.log(`Transport: ${transportModeLabel}`);
  }

  // Start transport (handles both polling and webhook modes)
  await transport.start();
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
