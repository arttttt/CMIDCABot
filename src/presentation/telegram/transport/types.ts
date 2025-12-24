/**
 * Bot transport interface for abstracting update delivery mechanism
 * Supports both polling (development) and webhook (production) modes
 */

import type { Bot, Context } from "grammy";
import type { TransportMode } from "../../../infrastructure/shared/config/index.js";
import type { HttpHandler } from "../../../infrastructure/shared/http/index.js";

export type { TransportMode };

export interface TransportConfig {
  mode: TransportMode;
  webhook?: WebhookConfig;
}

export interface WebhookConfig {
  /** Full public URL for webhook (e.g., https://app.example.com/webhook) */
  url: string;
  /** Secret token for request validation */
  secret?: string;
  /** Port for webhook server (uses health server) */
  port: number;
  /** Host for webhook server */
  host: string;
  /** Additional HTTP handlers (e.g., SecretPageHandler) */
  handlers?: HttpHandler[];
}

export interface BotTransport {
  /**
   * Start receiving updates
   * For polling: starts long polling
   * For webhook: registers webhook and starts HTTP server
   */
  start(): Promise<void>;

  /**
   * Stop receiving updates and clean up
   * For polling: stops polling and closes bot session
   * For webhook: removes webhook and stops HTTP server
   */
  stop(): Promise<void>;
}

export interface TransportDeps {
  bot: Bot<Context>;
  isDev: boolean;
  onStart?: (botInfo: { username: string }) => void;
}
