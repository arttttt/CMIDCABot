/**
 * InMemoryImportSessionRepository - repository implementation for import sessions
 *
 * Wraps ImportSessionCache data source and implements ImportSessionRepository interface.
 */

import type { TelegramId } from "../../../domain/models/id/index.js";
import {
  ImportSessionRepository,
  FormSession,
} from "../../../domain/repositories/ImportSessionRepository.js";
import { ImportSessionCache } from "../../sources/memory/ImportSessionCache.js";

export class InMemoryImportSessionRepository implements ImportSessionRepository {
  constructor(private readonly cache: ImportSessionCache) {}

  store(telegramId: TelegramId): string {
    return this.cache.store(telegramId);
  }

  getTtlMinutes(): number {
    return this.cache.getTtlMinutes();
  }

  consumeToForm(token: string): FormSession | null {
    return this.cache.consumeToForm(token);
  }

  consumeForm(csrfToken: string): TelegramId | null {
    return this.cache.consumeForm(csrfToken);
  }
}
