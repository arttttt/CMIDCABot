/**
 * Branded type for request tracing UUID
 *
 * Provides compile-time type safety for request identifiers
 * with zero runtime overhead after validation.
 */

declare const __brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [__brand]: B };

/**
 * Request tracing UUID - standard UUID v4 format
 */
export type RequestId = Brand<string, "RequestId">;

/**
 * Regex pattern for valid UUID (v4 format, case-insensitive)
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Create a validated RequestId
 *
 * @param value - Raw string value
 * @returns Branded RequestId
 * @throws Error if value is not a valid UUID
 */
export function requestId(value: string): RequestId {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid request ID: ${value}`);
  }
  return value as RequestId;
}
