/**
 * Branded type for Telegram user ID
 *
 * Provides compile-time type safety for Telegram IDs
 * with zero runtime overhead after validation.
 */

declare const __brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [__brand]: B };

/**
 * Telegram user ID - positive integer assigned by Telegram
 */
export type TelegramId = Brand<number, "TelegramId">;

/**
 * Create a validated TelegramId
 *
 * @param value - Raw number value
 * @returns Branded TelegramId
 * @throws Error if value is not a positive integer
 */
export function telegramId(value: number): TelegramId {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid Telegram ID: ${value}`);
  }
  return value as TelegramId;
}
