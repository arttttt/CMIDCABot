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
import { setLogger, DebugLogger, NoOpLogger, logger } from "./infrastructure/shared/logging/index.js";
import { OwnerConfig } from "./domain/models/OwnerConfig.js";
import { createTelegramBot, attachGateway } from "./presentation/telegram/index.js";
import { TelegramMessageSender } from "./presentation/telegram/TelegramMessageSender.js";
import { createStorage } from "./app/createStorage.js";
import { createBlockchain } from "./app/createBlockchain.js";
import { createUseCases } from "./app/createUseCases.js";
import { createPresentation } from "./app/createPresentation.js";
import { createBotTransport } from "./app/createTransport.js";
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
    useCases,
  });

  await useCases.initializeAuthorization.execute();

  console.log("Starting DCA Telegram Bot...");

  // Single bot instance: init() fetches botInfo (needed for invite links)
  // before the gateway is built; the same api drives both updates and notifications.
  const bot = createTelegramBot(config.telegram.botToken, config.isDev);
  await bot.init();
  const botInfo = bot.botInfo;
  const messageSender = new TelegramMessageSender(bot.api);

  const marketMonitorScheduler = await startMarketMonitor({
    config,
    storage,
    blockchain,
    useCases,
    messageSender,
    marketFormatter: presentation.marketFormatter,
  });

  const { registry, gateway } = presentation.createRegistryAndGateway(botInfo.username);
  console.log(`Command mode: ${registry.getModeInfo()?.label ?? "Production"}`);

  attachGateway(bot, gateway);
  presentation.userResolver.setApi(bot.api);

  const { transport, httpServer } = createBotTransport({
    config,
    bot,
    storage,
    useCases,
    messageSender,
    onStart: (info) => {
      if (!config.isDev) {
        console.log(`Bot @${info.username} is running`);
      }
    },
  });

  // Graceful shutdown: guard against re-entry (double Ctrl+C / SIGINT
  // after SIGTERM) and keep going if a step fails - the DBs must get
  // their destroy() attempt even when the transport hangs on stop.
  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log("\nShutting down...");

    const steps: Array<[string, () => void | Promise<unknown>]> = [
      ["http server", () => httpServer?.stop()],
      ["transport", () => transport.stop()],
      ["market monitor", () => marketMonitorScheduler.stop()],
      ["cleanup scheduler", () => storage.cleanupScheduler.stop()],
      ["main db", () => storage.mainDb.destroy()],
      ["auth db", () => storage.authDb.destroy()],
    ];

    for (const [name, step] of steps) {
      try {
        await step();
      } catch (error) {
        logger.error("Shutdown", `Failed to stop ${name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

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
