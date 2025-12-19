/**
 * Factory for creating bot transport based on configuration
 */

import type { BotTransport, TransportConfig, TransportDeps } from "./types.js";
import { PollingTransport } from "./PollingTransport.js";
import { WebhookTransport } from "./WebhookTransport.js";

export function createTransport(
  config: TransportConfig,
  deps: TransportDeps,
): BotTransport {
  switch (config.mode) {
    case "webhook":
      if (!config.webhook) {
        throw new Error("Webhook configuration is required for webhook mode");
      }
      return new WebhookTransport(deps, config.webhook);

    case "polling":
    default:
      return new PollingTransport(deps);
  }
}

/**
 * Validates transport configuration
 * Throws error if configuration is invalid
 */
export function validateTransportConfig(config: TransportConfig): void {
  if (config.mode === "webhook") {
    if (!config.webhook?.url) {
      throw new Error(
        "WEBHOOK_URL is required when BOT_TRANSPORT=webhook. " +
        "Set a publicly accessible URL where Telegram can send updates."
      );
    }

    // Validate URL format
    try {
      const url = new URL(config.webhook.url);
      if (url.protocol !== "https:") {
        throw new Error(
          "WEBHOOK_URL must use HTTPS. " +
          "Telegram requires a valid HTTPS URL for webhooks."
        );
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(
          `WEBHOOK_URL is not a valid URL: ${config.webhook.url}`
        );
      }
      throw error;
    }
  }
}
