/**
 * Polling transport implementation
 * Uses long polling to receive updates from Telegram
 * Includes retry logic for 409 Conflict errors during redeploys
 */

import type { BotTransport, TransportDeps } from "./types.js";
import { logger } from "../../../infrastructure/shared/logging/index.js";

export class PollingTransport implements BotTransport {
  private readonly deps: TransportDeps;
  private readonly maxRetries = 10;
  private readonly baseDelayMs = 3000;

  constructor(deps: TransportDeps) {
    this.deps = deps;
  }

  async start(): Promise<void> {
    const { bot, onStart } = this.deps;

    // Delete any existing webhook to ensure polling works
    await bot.api.deleteWebhook({ drop_pending_updates: true });

    // Start bot with retry on 409 Conflict
    // During redeploys, old instance may still hold polling connection
    // We need to wait for it to be terminated by the platform
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await bot.start({
          onStart: (botInfo) => {
            onStart?.({ username: botInfo.username });
            logger.info("PollingTransport", "Running (polling mode)", {
              username: botInfo.username,
            });
          },
        });
        break; // Success, exit retry loop
      } catch (error) {
        const is409 = error instanceof Error &&
          error.message.includes("409") &&
          error.message.includes("Conflict");

        if (is409 && attempt < this.maxRetries) {
          const delayMs = this.baseDelayMs * Math.pow(2, attempt - 1);
          logger.warn("PollingTransport", "Instance conflict, waiting for old instance to stop", {
            attempt,
            maxRetries: this.maxRetries,
            delayMs,
          });

          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          throw error;
        }
      }
    }
  }

  async stop(): Promise<void> {
    const { bot } = this.deps;

    try {
      // Close bot session to release getUpdates lock
      await bot.api.close();
    } catch {
      // Ignore close errors
    }
    await bot.stop();
  }
}
