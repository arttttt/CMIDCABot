// Load .env file before any config is read
try {
  process.loadEnvFile();
} catch {
  console.log("No .env file found, using environment variables");
}

import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };
import { loadConfig } from "./infrastructure/shared/config/index.js";
import { setLogger, DebugLogger, NoOpLogger } from "./infrastructure/shared/logging/index.js";
import { HttpServer } from "./infrastructure/shared/http/index.js";
import { OwnerConfig } from "./domain/models/OwnerConfig.js";
import {
  createTelegramBot,
  createTransport,
  validateTransportConfig,
  type TransportConfig as TelegramTransportConfig,
} from "./presentation/telegram/index.js";
import { TelegramMessageSender } from "./presentation/telegram/TelegramMessageSender.js";
import { SecretPageHandler } from "./presentation/web/SecretPageHandler.js";
import { ImportPageHandler } from "./presentation/web/ImportPageHandler.js";
import { createStorage } from "./app/createStorage.js";
import { createBlockchain } from "./app/createBlockchain.js";
import { createUseCases } from "./app/createUseCases.js";
import { createPresentation } from "./app/createPresentation.js";
import { startMarketMonitor } from "./app/createMarketMonitor.js";

async function main(): Promise<void> {
  console.log(`CMI DCA Bot v${pkg.version}`);

  const config = loadConfig();
  setLogger(config.isDev ? new DebugLogger() : new NoOpLogger());

  // Compose the application
  const storage = await createStorage(config);
  const ownerConfig = new OwnerConfig(config.auth.ownerTelegramId);
  const blockchain = createBlockchain(config, storage.encryptionService);
  const useCases = createUseCases(storage, blockchain, ownerConfig);
  const presentation = createPresentation({
    config,
    version: pkg.version,
    ownerConfig,
    storage,
    blockchain,
    useCases,
  });

  await useCases.initializeAuthorization.execute();

  console.log("Starting DCA Telegram Bot...");

  // Get bot info first to have botUsername for invite links and API for message sending
  const { Bot } = await import("grammy");
  const tempBot = new Bot(config.telegram.botToken);
  const botInfo = await tempBot.api.getMe();
  const messageSender = new TelegramMessageSender(tempBot.api);

  // HTTP page handlers (shared between polling and webhook modes)
  const secretPageHandler = new SecretPageHandler(storage.secretStore);
  const importPageHandler = new ImportPageHandler(
    storage.importSessionStore,
    useCases.importWallet,
    messageSender,
  );

  const marketMonitorScheduler = await startMarketMonitor({
    config,
    storage,
    blockchain,
    useCases,
    messageSender,
    marketFormatter: presentation.marketFormatter,
  });

  // Transport configuration
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
  validateTransportConfig(transportConfig);

  // HTTP server for polling mode (webhook mode has its own server with handlers)
  let httpServer: HttpServer | undefined;
  if (config.transport.mode === "polling") {
    httpServer = new HttpServer(config.http);
    httpServer.addHandler(secretPageHandler);
    httpServer.addHandler(importPageHandler);
    httpServer.start();
  }

  const { registry, gateway } = presentation.createRegistryAndGateway(botInfo.username);
  console.log(`Command mode: ${registry.getModeInfo()?.label ?? "Production"}`);

  const bot = createTelegramBot(config.telegram.botToken, gateway, config.isDev);
  presentation.userResolver.setApi(bot.api);

  const transport = createTransport(transportConfig, {
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
    marketMonitorScheduler.stop();
    storage.cleanupScheduler.stop();
    await storage.mainDb.destroy();
    await storage.authDb.destroy();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  logStartupInfo(config, botInfo.username);

  // Start transport (handles both polling and webhook modes)
  await transport.start();
}

function logStartupInfo(config: ReturnType<typeof loadConfig>, botUsername: string): void {
  const transportModeLabel = config.transport.mode === "webhook" ? "Webhook" : "Long Polling";

  if (config.isDev) {
    console.log("─".repeat(50));
    console.log("DEVELOPMENT MODE");
    console.log("─".repeat(50));
    console.log(`Bot: @${botUsername}`);
    console.log(`RPC: ${maskUrl(config.solana.rpcUrl)}`);
    console.log(`Mode: ${transportModeLabel}`);
    console.log("Prices: Jupiter API (real-time)");
    console.log(`Secret links: ${config.http.publicUrl}/secret/{token}`);
    console.log(`Import links: ${config.http.publicUrl}/import/{token}`);
    console.log("─".repeat(50));
    console.log("Bot is ready! Send /start in Telegram to test.");
    console.log("Press Ctrl+C to stop.\n");
  } else {
    console.log(`Bot @${botUsername} starting...`);
    console.log(`RPC: ${maskUrl(config.solana.rpcUrl)}`);
    console.log(`Transport: ${transportModeLabel}`);
  }
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
