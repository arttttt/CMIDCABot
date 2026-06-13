/**
 * Telegram adapter exports
 */

export { createTelegramBot, attachGateway } from "./TelegramAdapter.js";
export {
  type BotTransport,
  type TransportConfig,
  createTransport,
  validateTransportConfig,
} from "./transport/index.js";
