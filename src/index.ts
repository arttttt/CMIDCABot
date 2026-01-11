// Load .env file before any config is read
try {
  process.loadEnvFile();
} catch {
  console.log("No .env file found, using environment variables");
}

import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };
import { loadConfig, OwnerConfig } from "./infrastructure/shared/config/index.js";
import { setLogger, DebugLogger, NoOpLogger } from "./infrastructure/shared/logging/index.js";
import { createMainDatabase, createAuthDatabase } from "./data/sources/database/index.js";
import { createMainRepositories } from "./data/factories/RepositoryFactory.js";
import { SQLiteAuthRepository } from "./data/repositories/sqlite/SQLiteAuthRepository.js";
import { SQLiteInviteTokenRepository } from "./data/repositories/sqlite/SQLiteInviteTokenRepository.js";
import { CachedBalanceRepository } from "./data/repositories/memory/CachedBalanceRepository.js";
import { SolanaBlockchainRepository } from "./data/repositories/SolanaBlockchainRepository.js";
import { JupiterPriceRepository } from "./data/repositories/JupiterPriceRepository.js";
import { JupiterSwapRepository } from "./data/repositories/JupiterSwapRepository.js";
import { SolanaRpcClient } from "./data/sources/api/SolanaRpcClient.js";
import { JupiterPriceClient } from "./data/sources/api/JupiterPriceClient.js";
import { JupiterSwapClient } from "./data/sources/api/JupiterSwapClient.js";
import { KeyEncryptionService } from "./infrastructure/internal/crypto/index.js";
import { TelegramUserResolver } from "./presentation/telegram/UserResolver.js";
// TODO: restore after DcaScheduler refactoring
// import { DcaScheduler } from "./_wip/dca-scheduling/index.js";
import {
  InitUserUseCase,
  ExecutePurchaseUseCase,
  GetPortfolioStatusUseCase,
  DetermineAssetToBuyUseCase,
  WalletInfoHelper,
  GetWalletInfoUseCase,
  CreateWalletUseCase,
  ImportWalletUseCase,
  DeleteWalletUseCase,
  ExportWalletKeyUseCase,
  StartDcaUseCase,
  StopDcaUseCase,
  GetDcaStatusUseCase,
  GetPricesUseCase,
  GetQuoteUseCase,
  ExecuteSwapUseCase,
  GenerateInviteUseCase,
  ActivateInviteUseCase,
  DeleteUserDataUseCase,
  InitializeAuthorizationUseCase,
  AddAuthorizedUserUseCase,
  RemoveAuthorizedUserUseCase,
  GetAllAuthorizedUsersUseCase,
  UpdateUserRoleUseCase,
  GetUserRoleUseCase,
} from "./domain/usecases/index.js";
import type { ImportSessionRepository } from "./domain/repositories/index.js";
import { GatewayFactory } from "./presentation/protocol/gateway/index.js";
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
  SwapFormatter,
  AdminFormatter,
  InviteFormatter,
  ProgressFormatter,
  ConfirmationFormatter,
  HelpFormatter,
} from "./presentation/formatters/index.js";
import {
  createTelegramBot,
  createTransport,
  validateTransportConfig,
  type BotTransport,
  type TransportConfig as TelegramTransportConfig,
} from "./presentation/telegram/index.js";
import { HttpServer } from "./infrastructure/shared/http/index.js";
import { SecretCache, ImportSessionCache, RateLimitCache, ConfirmationCache } from "./data/sources/memory/index.js";
import { InMemorySecretRepository, InMemoryImportSessionRepository, InMemoryRateLimitRepository, InMemoryConfirmationRepository } from "./data/repositories/memory/index.js";
import { CleanupScheduler } from "./infrastructure/shared/scheduling/index.js";
import { SecretPageHandler } from "./presentation/web/SecretPageHandler.js";
import { ImportPageHandler } from "./presentation/web/ImportPageHandler.js";
import { TelegramMessageSender } from "./presentation/telegram/TelegramMessageSender.js";

async function main(): Promise<void> {
  console.log(`CMI DCA Bot v${pkg.version}`);

  const config = loadConfig();

  // Initialize logger based on environment
  setLogger(config.isDev ? new DebugLogger() : new NoOpLogger());

  // Initialize encryption service (required for private key protection)
  const encryptionService = new KeyEncryptionService();
  await encryptionService.initialize(config.encryption.masterKey);

  // Initialize database connections
  const mainDb = createMainDatabase(config.database.path);
  const authDb = createAuthDatabase(config.auth.dbPath);

  // Create repositories
  const { userRepository, transactionRepository } = createMainRepositories(mainDb, encryptionService);

  // Create auth repository
  const authRepository = new SQLiteAuthRepository(authDb);

  // Create invite token repository
  const inviteTokenRepository = new SQLiteInviteTokenRepository(authDb);

  // Initialize owner configuration (single source of truth)
  const ownerConfig = new OwnerConfig(config.auth.ownerTelegramId);

  // Initialize owner authorization
  const initializeAuth = new InitializeAuthorizationUseCase(authRepository, ownerConfig);
  await initializeAuth.execute();

  // Create GetUserRoleUseCase for Gateway and use cases
  const getUserRole = new GetUserRoleUseCase(authRepository, ownerConfig);

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

  // Initialize RateLimitCache for rate limiting
  const rateLimitCache = new RateLimitCache({
    windowMs: config.rateLimit.windowMs,
    maxRequests: config.rateLimit.maxRequests,
  });
  const rateLimitRepository = new InMemoryRateLimitRepository(rateLimitCache);

  // Initialize ConfirmationCache for purchase/swap confirmation flow
  const confirmationCache = new ConfirmationCache();
  const confirmationRepository = new InMemoryConfirmationRepository(confirmationCache);
  const confirmationFormatter = new ConfirmationFormatter();

  // Start cleanup scheduler for expired secrets, import sessions, and invite tokens
  const cleanupScheduler = new CleanupScheduler([
    { store: secretCache, intervalMs: 60_000, name: "secretCache" },
    { store: importSessionCache, intervalMs: 60_000, name: "importSessionCache" },
    { store: inviteTokenRepository, intervalMs: 3_600_000, name: "inviteTokenRepository" },
    { store: confirmationCache, intervalMs: 60_000, name: "confirmationCache" },
  ]);
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
  const addAuthorizedUser = new AddAuthorizedUserUseCase(authRepository, getUserRole);
  const removeAuthorizedUser = new RemoveAuthorizedUserUseCase(authRepository, getUserRole, ownerConfig);
  const getAllAuthorizedUsers = new GetAllAuthorizedUsersUseCase(authRepository);
  const updateUserRole = new UpdateUserRoleUseCase(authRepository, getUserRole, ownerConfig);

  // Create delete user data use case
  const deleteUserData = new DeleteUserDataUseCase(
    removeAuthorizedUser,
    userRepository,
    transactionRepository,
  );

  // TODO: restore DcaScheduler after refactoring
  const dcaScheduler = undefined;

  // Create helpers
  const walletHelper = new WalletInfoHelper(blockchainRepository, balanceRepository, config.dcaWallet);

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
  const initUser = new InitUserUseCase(userRepository);
  const getWalletInfo = new GetWalletInfoUseCase(userRepository, walletHelper);
  const createWallet = new CreateWalletUseCase(userRepository, blockchainRepository, walletHelper, secretStore);
  const importWallet = new ImportWalletUseCase(userRepository, blockchainRepository, walletHelper);
  const deleteWallet = new DeleteWalletUseCase(userRepository, walletHelper);
  const exportWalletKey = new ExportWalletKeyUseCase(userRepository, secretStore, config.dcaWallet);
  const startDca = new StartDcaUseCase(userRepository, dcaScheduler);
  const stopDca = new StopDcaUseCase(userRepository, dcaScheduler);
  const getDcaStatus = new GetDcaStatusUseCase(userRepository, dcaScheduler);
  const getPrices = new GetPricesUseCase(priceRepository);
  const getQuote = new GetQuoteUseCase(swapRepository);

  // Create use cases that require Jupiter repositories
  const determineAssetToBuy = priceRepository
    ? new DetermineAssetToBuyUseCase(
        userRepository,
        balanceRepository,
        blockchainRepository,
        priceRepository,
        config.dcaWallet.devPrivateKey,
      )
    : undefined;

  const executePurchase = swapRepository && determineAssetToBuy
    ? new ExecutePurchaseUseCase(
        executeSwapUseCase,
        determineAssetToBuy,
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
  const swapFormatter = new SwapFormatter();
  const adminFormatter = new AdminFormatter();
  const progressFormatter = new ProgressFormatter();
  const helpFormatter = new HelpFormatter();

  // Helper function to build registry and handler
  function createRegistryAndHandler(withImportSession: ImportSessionRepository, botUsername?: string) {
    // Create invite formatter if botUsername is available
    const inviteFormatter = botUsername ? new InviteFormatter(botUsername) : undefined;

    // Start command deps (shared between dev and prod)
    const startDeps = {
      initUser,
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

    // Help command deps (shared between dev and prod)
    // Note: getRegistry is added in registry constructor to break circular dependency
    const helpDeps = {
      helpFormatter,
    };

    // Build command registry based on mode
    let registry: CommandRegistry;

    if (config.isDev) {
      const deps: DevCommandRegistryDeps = {
        start: startDeps,
        wallet: {
          getWalletInfo,
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
          determineAssetToBuy,
          portfolioFormatter,
          purchaseFormatter,
          progressFormatter,
          confirmationRepository,
          confirmationFormatter,
          swapRepository,
        },
        prices: {
          getPrices,
          formatter: priceFormatter,
        },
        swap: {
          getQuote,
          executeSwap: executeSwapUseCase,
          quoteFormatter,
          swapFormatter,
          progressFormatter,
          confirmationRepository,
          confirmationFormatter,
          swapRepository,
        },
        admin: adminDeps,
        version: versionDeps,
        help: helpDeps,
      };
      registry = new DevCommandRegistry(deps);
    } else {
      const deps: ProdCommandRegistryDeps = {
        start: startDeps,
        wallet: {
          getWalletInfo,
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
          determineAssetToBuy,
          portfolioFormatter,
          purchaseFormatter,
          progressFormatter,
          confirmationRepository,
          confirmationFormatter,
          swapRepository,
        },
        admin: adminDeps,
        version: versionDeps,
        help: helpDeps,
      };
      registry = new ProdCommandRegistry(deps);
    }

    // Create gateway
    const gateway = GatewayFactory.create({
      getUserRole,
      commandRegistry: registry,
      rateLimitRepository,
      ownerConfig,
    });

    return { registry, gateway };
  }

  // Cleanup function
  const cleanup = async (): Promise<void> => {
    cleanupScheduler.stop();
    await mainDb?.destroy();
    await authDb?.destroy();
  };

  // Start Telegram bot
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

  // Create gateway with importSessionStore and botUsername
  const { registry, gateway } = createRegistryAndHandler(importSessionStore, botInfo.username);

  const modeInfo = registry.getModeInfo();
  const modeLabel = modeInfo?.label ?? "Production";
  console.log(`Command mode: ${modeLabel}`);

  // Create the bot with the gateway
  const bot = createTelegramBot(config.telegram.botToken, gateway, config.isDev);

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
