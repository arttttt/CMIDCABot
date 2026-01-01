/**
 * Transport-agnostic user identity
 *
 * Discriminated union for identifying users across different transports.
 * Each variant has type-safe fields specific to its transport.
 */
import type { TelegramId, SessionId } from "../../types/id/index.js";

export type UserIdentity =
  | { provider: "telegram"; telegramId: TelegramId }
  | { provider: "http"; sessionId: SessionId };
