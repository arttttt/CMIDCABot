/**
 * Polling transport implementation
 * Uses long polling to receive updates from Telegram
 * Includes retry logic for 409 Conflict errors during redeploys
 */

import type { BotTransport, TransportDeps } from "./types.js";

export class PollingTransport implements BotTransport {
  private readonly deps: TransportDeps;
  private readonly maxRetries = 10;
  private readonly baseDelayMs = 3000;

  constructor(deps: TransportDeps) {
    this.deps = deps;
  }

  async start(): Promise<void> {
    const { bot, isDev, onStart } = this.deps;

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
            if (!isDev) {
              console.log(`Bot @${botInfo.username} is running (polling mode)`);
            }
          },
        });
        break; // Success, exit retry loop
      } catch (error) {
        const is409 = error instanceof Error &&
          error.message.includes("409") &&
          error.message.includes("Conflict");

        if (is409 && attempt < this.maxRetries) {
          const delayMs = this.baseDelayMs * Math.pow(2, attempt - 1);
          console.log(
            `Bot instance conflict detected (attempt ${attempt}/${this.maxRetries}), ` +
            `waiting ${delayMs / 1000}s for old instance to stop...`
          );

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
