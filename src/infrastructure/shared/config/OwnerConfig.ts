/**
 * OwnerConfig - value object for owner identity configuration
 *
 * Encapsulates the owner's Telegram ID for consistent passing
 * through the application layers.
 */

import { TelegramId } from "../../../domain/models/id/index.js";

export class OwnerConfig {
  readonly telegramId: TelegramId;

  constructor(rawTelegramId: number) {
    this.telegramId = new TelegramId(rawTelegramId);
  }
}
