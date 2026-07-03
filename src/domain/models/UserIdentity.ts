/**
 * Transport-agnostic user identity
 *
 * Discriminated union for identifying users across transports.
 * Telegram is the only transport today; new variants join the union
 * when a real second transport appears.
 *
 * Use factory methods to create instances - anonymous objects are not allowed.
 */
import type { TelegramId } from "./id/index.js";

declare const __brand: unique symbol;

export type TelegramIdentity = {
  readonly [__brand]: "TelegramIdentity";
  provider: "telegram";
  telegramId: TelegramId;
};

export type UserIdentity = TelegramIdentity;

export const UserIdentity = {
  telegram: (telegramId: TelegramId): TelegramIdentity =>
    ({ provider: "telegram", telegramId }) as TelegramIdentity,
} as const;
