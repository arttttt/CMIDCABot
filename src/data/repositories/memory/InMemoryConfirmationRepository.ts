/**
 * InMemoryConfirmationRepository - repository implementation for confirmations
 *
 * Wraps ConfirmationCache data source and implements ConfirmationRepository interface.
 */

import type { TelegramId, ConfirmationSessionId } from "../../../domain/models/id/index.js";
import type { SwapQuote } from "../../../domain/repositories/SwapRepository.js";
import {
  ConfirmationRepository,
  ConfirmationType,
  ConfirmationSession,
} from "../../../domain/repositories/ConfirmationRepository.js";
import { ConfirmationCache } from "../../sources/memory/ConfirmationCache.js";

export class InMemoryConfirmationRepository implements ConfirmationRepository {
  constructor(private readonly cache: ConfirmationCache) {}

  store(
    telegramId: TelegramId,
    type: ConfirmationType,
    amount: number,
    asset: string,
    quote: SwapQuote,
  ): ConfirmationSessionId {
    return this.cache.store(telegramId, type, amount, asset, quote);
  }

  get(sessionId: ConfirmationSessionId): ConfirmationSession | null {
    return this.cache.get(sessionId);
  }

  consume(sessionId: ConfirmationSessionId): ConfirmationSession | null {
    return this.cache.consume(sessionId);
  }

  updateQuote(sessionId: ConfirmationSessionId, newQuote: SwapQuote): boolean {
    return this.cache.updateQuote(sessionId, newQuote);
  }

  cancel(sessionId: ConfirmationSessionId): boolean {
    return this.cache.cancel(sessionId);
  }

  getTtlSeconds(): number {
    return this.cache.getTtlSeconds();
  }
}
