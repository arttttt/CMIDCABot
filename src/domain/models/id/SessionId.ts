/**
 * Branded type for HTTP session identifier
 *
 * Provides compile-time type safety for session identifiers
 * with zero runtime overhead after validation.
 */

declare const __brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [__brand]: B };

/**
 * HTTP session identifier - non-empty string
 */
export type SessionId = Brand<string, "SessionId">;

/**
 * Create a validated SessionId
 *
 * @param value - Raw string value
 * @returns Branded SessionId
 * @throws Error if value is empty
 */
export function sessionId(value: string): SessionId {
  if (!value || value.trim().length === 0) {
    throw new Error("Invalid session ID: must be non-empty");
  }
  return value as SessionId;
}
