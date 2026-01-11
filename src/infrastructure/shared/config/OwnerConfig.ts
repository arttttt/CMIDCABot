/**
 * OwnerConfig - value object for owner identity configuration
 *
 * Encapsulates the owner's Telegram ID for consistent passing
 * through the application layers.
 */

import type { TelegramId } from "../../../domain/models/id/index.js";

export interface OwnerConfig {
  readonly telegramId: TelegramId;
}
