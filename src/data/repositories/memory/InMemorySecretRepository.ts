/**
 * InMemorySecretRepository - repository implementation for secure one-time secrets
 *
 * Wraps SecretCache data source and implements SecretStoreRepository interface.
 */

import type { TelegramId } from "../../../domain/models/id/index.js";
import { SecretStoreRepository } from "../../../domain/repositories/SecretStoreRepository.js";
import { SecretCache } from "../../sources/memory/SecretCache.js";

export class InMemorySecretRepository implements SecretStoreRepository {
  constructor(private readonly cache: SecretCache) {}

  async store(payload: string, telegramId: TelegramId): Promise<string> {
    return this.cache.store(payload, telegramId);
  }

  async consume(token: string): Promise<string | null> {
    return this.cache.consume(token);
  }

  getTtlMinutes(): number {
    return this.cache.getTtlMinutes();
  }
}
