/**
 * Transport composition - HTTP page handlers, HTTP server (polling mode)
 * and the Telegram transport, wired from config
 */

import type { Bot, Context } from "grammy";
import type { Config } from "../infrastructure/shared/config/envSchema.js";
import { HttpServer } from "../infrastructure/shared/http/index.js";
import {
  createTransport,
  validateTransportConfig,
  type BotTransport,
  type TransportConfig as TelegramTransportConfig,
} from "../presentation/telegram/index.js";
import type { MessageSender } from "../presentation/telegram/MessageSender.js";
import { SecretPageHandler } from "../presentation/web/SecretPageHandler.js";
import { ImportPageHandler } from "../presentation/web/ImportPageHandler.js";
import { WalletFormatter } from "../presentation/formatters/index.js";
import type { Storage } from "./createStorage.js";
import type { UseCases } from "./createUseCases.js";

export interface BotTransportDeps {
  config: Config;
  bot: Bot<Context>;
  storage: Storage;
  useCases: UseCases;
  messageSender: MessageSender;
  onStart: (info: { username: string }) => void;
}

export interface BotTransportSetup {
  transport: BotTransport;
  /** Present only in polling mode; webhook mode serves pages from its own server */
  httpServer?: HttpServer;
}

export function createBotTransport(deps: BotTransportDeps): BotTransportSetup {
  const { config, bot, storage, useCases, messageSender, onStart } = deps;

  // HTTP page handlers (shared between polling and webhook modes)
  const secretPageHandler = new SecretPageHandler(storage.secretStore);
  const importPageHandler = new ImportPageHandler(
    storage.importSessionStore,
    useCases.importWallet,
    messageSender,
    new WalletFormatter(),
  );

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

  const transport = createTransport(transportConfig, {
    bot,
    isDev: config.isDev,
    onStart,
  });

  return { transport, httpServer };
}
