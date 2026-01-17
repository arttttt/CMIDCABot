import type { TelegramId } from "../models/id/index.js";

export class WalletCreationLock {
  static readonly TTL_MS = 2 * 60 * 1000;

  static getKey(telegramId: TelegramId): string {
    return `tg:${telegramId.value}:wallet_create`;
  }
}
