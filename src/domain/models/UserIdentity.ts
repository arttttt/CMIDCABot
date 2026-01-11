/**
 * Transport-agnostic user identity
 *
 * Discriminated union for identifying users across different transports.
 * Each variant has type-safe fields specific to its transport.
 *
 * Use factory methods to create instances - anonymous objects are not allowed.
 */
import type { TelegramId, SessionId } from "./id/index.js";

declare const __brand: unique symbol;

export type TelegramIdentity = {
  readonly [__brand]: "TelegramIdentity";
  provider: "telegram";
  telegramId: TelegramId;
};

export type HttpIdentity = {
  readonly [__brand]: "HttpIdentity";
  provider: "http";
  sessionId: SessionId;
};

export type UserIdentity = TelegramIdentity | HttpIdentity;

export const UserIdentity = {
  telegram: (telegramId: TelegramId): TelegramIdentity =>
    ({ provider: "telegram", telegramId }) as TelegramIdentity,
  http: (sessionId: SessionId): HttpIdentity =>
    ({ provider: "http", sessionId }) as HttpIdentity,
} as const;
