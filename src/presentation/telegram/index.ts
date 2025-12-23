/**
 * Telegram adapter exports
 */

export { createTelegramBot } from "./TelegramAdapter.js";
export {
  type BotTransport,
  type TransportConfig,
  type TransportMode,
  type WebhookConfig,
  type TransportDeps,
  createTransport,
  validateTransportConfig,
} from "./transport/index.js";

// MessageSender port and implementation
export type { MessageSender } from "./MessageSender.js";
export { TelegramMessageSender } from "./TelegramMessageSender.js";

// UserResolver
export {
  type UserResolver,
  type ResolveResult,
  TelegramUserResolver,
  isUsername,
  parseNumericId,
  normalizeUsername,
} from "./UserResolver.js";
