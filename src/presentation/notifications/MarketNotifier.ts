/**
 * MarketNotifier - market monitor tick orchestrator
 *
 * Called periodically by MarketMonitorScheduler:
 * collects prices, analyzes for signals, broadcasts notifications
 * to all authorized users, and sends the daily digest once a day.
 */

import type { CollectMarketDataUseCase } from "../../domain/usecases/CollectMarketDataUseCase.js";
import type { AnalyzeMarketUseCase } from "../../domain/usecases/AnalyzeMarketUseCase.js";
import type { GetMarketDigestUseCase } from "../../domain/usecases/GetMarketDigestUseCase.js";
import type { GetAllAuthorizedUsersUseCase } from "../../domain/usecases/GetAllAuthorizedUsersUseCase.js";
import { DAY_MS } from "../../domain/constants/market.js";
import type { MessageSender } from "../telegram/MessageSender.js";
import type { ClientResponse } from "../protocol/types.js";
import type { MarketFormatter } from "../formatters/MarketFormatter.js";
import { logger } from "../../infrastructure/shared/logging/index.js";

export interface MarketNotifierDeps {
  collectMarketData: CollectMarketDataUseCase;
  analyzeMarket: AnalyzeMarketUseCase;
  getMarketDigest: GetMarketDigestUseCase;
  getAllAuthorizedUsers: GetAllAuthorizedUsersUseCase;
  messageSender: MessageSender;
  marketFormatter: MarketFormatter;
  /** UTC hour (0-23) after which the daily digest is sent */
  digestHourUtc: number;
}

export class MarketNotifier {
  /** UTC day number of the last sent digest. Resets on restart: a digest may repeat once after a restart. */
  private lastDigestDay: number | null = null;

  constructor(private readonly deps: MarketNotifierDeps) {}

  async tick(): Promise<void> {
    const nowMs = Date.now();

    try {
      await this.deps.collectMarketData.execute(nowMs);
    } catch (error) {
      logger.warn("MarketNotifier", "Price collection failed, skipping tick", {
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    const signals = await this.deps.analyzeMarket.execute(nowMs);
    if (signals.length > 0) {
      await this.broadcast(this.deps.marketFormatter.formatSignals(signals));
    }

    await this.maybeSendDigest(nowMs);
  }

  private async maybeSendDigest(nowMs: number): Promise<void> {
    const day = Math.floor(nowMs / DAY_MS);
    const hourUtc = new Date(nowMs).getUTCHours();
    if (hourUtc < this.deps.digestHourUtc || this.lastDigestDay === day) return;

    const digest = await this.deps.getMarketDigest.execute(nowMs);
    if (digest.assets.length === 0) return;

    await this.broadcast(this.deps.marketFormatter.formatDigest(digest));
    this.lastDigestDay = day;
  }

  private async broadcast(response: ClientResponse): Promise<void> {
    const { users } = await this.deps.getAllAuthorizedUsers.execute();

    for (const user of users) {
      try {
        await this.deps.messageSender.send(user.telegramId, response);
      } catch (error) {
        logger.warn("MarketNotifier", "Failed to notify user", {
          telegramId: user.telegramId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
