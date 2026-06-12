/**
 * Market monitor composition - backfill, notifier and polling scheduler
 */

import type { Config } from "../infrastructure/shared/config/envSchema.js";
import type { MessageSender } from "../presentation/telegram/MessageSender.js";
import type { MarketFormatter } from "../presentation/formatters/MarketFormatter.js";
import type { Storage } from "./createStorage.js";
import type { Blockchain } from "./createBlockchain.js";
import type { UseCases } from "./createUseCases.js";
import {
  CollectMarketDataUseCase,
  AnalyzeMarketUseCase,
  GetMarketDigestUseCase,
  BackfillPriceHistoryUseCase,
} from "../domain/usecases/index.js";
import { BinanceKlinesClient } from "../data/sources/api/BinanceKlinesClient.js";
import { BinanceHistoricalPriceRepository } from "../data/repositories/BinanceHistoricalPriceRepository.js";
import { MarketNotifier } from "../presentation/notifications/MarketNotifier.js";
import { MarketMonitorScheduler } from "../infrastructure/shared/scheduling/index.js";

export interface MarketMonitorDeps {
  config: Config;
  storage: Storage;
  blockchain: Blockchain;
  useCases: UseCases;
  messageSender: MessageSender;
  marketFormatter: MarketFormatter;
}

/**
 * Warm up price history (when enabled) and start the polling scheduler.
 */
export async function startMarketMonitor(deps: MarketMonitorDeps): Promise<MarketMonitorScheduler> {
  const { config, storage, blockchain, useCases, messageSender, marketFormatter } = deps;
  const { priceRepository } = blockchain;
  const { priceHistoryRepository, operationLockRepository } = storage;

  const marketNotifier = new MarketNotifier({
    collectMarketData: new CollectMarketDataUseCase(priceRepository, priceHistoryRepository),
    analyzeMarket: new AnalyzeMarketUseCase(priceHistoryRepository, operationLockRepository),
    getMarketDigest: new GetMarketDigestUseCase(priceHistoryRepository),
    getAllAuthorizedUsers: useCases.getAllAuthorizedUsers,
    messageSender,
    marketFormatter,
    digestHourUtc: config.market.digestHourUtc,
  });

  // Warm up price history on cold start before the first tick
  if (config.market.backfill === "binance") {
    const backfillPriceHistory = new BackfillPriceHistoryUseCase(
      priceHistoryRepository,
      new BinanceHistoricalPriceRepository(new BinanceKlinesClient()),
    );
    await backfillPriceHistory.execute(Date.now());
  }

  const scheduler = new MarketMonitorScheduler(
    () => marketNotifier.tick(),
    config.market.pollIntervalMs,
  );
  scheduler.start();

  return scheduler;
}
