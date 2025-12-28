/**
 * Transport-agnostic user identity
 *
 * Discriminated union for identifying users across different transports.
 * Each variant has type-safe fields specific to its transport.
 */
export type UserIdentity =
  | { provider: "telegram"; telegramId: number }
  | { provider: "http"; sessionId: string };
