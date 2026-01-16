import type { TelegramId } from "../models/id/index.js";

export class BalanceOperationLock {
  static readonly TTL_MS = 15 * 60 * 1000;

  static getKey(telegramId: TelegramId): string {
    return `tg:${telegramId.value}:balance_mutation`;
  }
}
