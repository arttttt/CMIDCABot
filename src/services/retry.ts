/**
 * Retry utilities with exponential backoff
 */

import { logger } from "./logger.js";

/**
 * Check if an error is a rate limit error (HTTP 429)
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("429") || error.message.includes("Too Many Requests");
  }
  return false;
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay.
 *
 * @param attempt - Current attempt number (0-based)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay cap (optional)
 * @returns Delay in milliseconds
 */
export function calculateBackoff(attempt: number, baseDelayMs: number, maxDelayMs?: number): number {
  const delay = baseDelayMs * Math.pow(2, attempt);
  return maxDelayMs !== undefined ? Math.min(delay, maxDelayMs) : delay;
}

/**
 * Retry a function with exponential backoff.
 *
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries (default 3)
 * @param baseDelayMs - Base delay in milliseconds (default 1000)
 * @param shouldRetry - Predicate to determine if error is retryable (default: isRateLimitError)
 * @returns Result of the function
 * @throws Last error if all retries exhausted or error is not retryable
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  shouldRetry: (error: unknown) => boolean = isRateLimitError,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (!shouldRetry(error) || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delayMs = calculateBackoff(attempt, baseDelayMs);
      logger.debug("Retry", "Retrying after error", {
        attempt: attempt + 1,
        maxRetries,
        delayMs,
      });
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Result of a poll operation
 */
export type PollResult<T> =
  | { status: "success"; value: T }
  | { status: "failure"; reason: string }
  | { status: "timeout" };

/**
 * Options for pollWithBackoff
 */
export interface PollOptions {
  /** Maximum time to wait in milliseconds */
  timeoutMs: number;
  /** Base delay between polls in milliseconds (default 1000) */
  baseDelayMs?: number;
  /** Maximum delay cap in milliseconds (default 4000) */
  maxDelayMs?: number;
}

/**
 * Poll a function with exponential backoff until a condition is met or timeout.
 *
 * Use this for waiting on async operations like transaction confirmations
 * where the first checks should be fast but later checks can be spaced out.
 *
 * @param checkFn - Function that checks the status and returns a poll result
 * @param options - Polling configuration
 * @returns Final poll result
 */
export async function pollWithBackoff<T>(
  checkFn: () => Promise<PollResult<T>>,
  options: PollOptions,
): Promise<PollResult<T>> {
  const { timeoutMs, baseDelayMs = 1000, maxDelayMs = 4000 } = options;
  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await checkFn();

      if (result.status === "success" || result.status === "failure") {
        return result;
      }
      // status === "timeout" means continue polling
    } catch {
      // Ignore errors and continue polling
      // Transaction is already sent - need to wait for result
    }

    // Calculate remaining time to avoid overshooting timeout
    const elapsed = Date.now() - startTime;
    const remaining = timeoutMs - elapsed;

    if (remaining <= 0) {
      break;
    }

    // Exponential backoff with cap
    const delayMs = Math.min(calculateBackoff(attempt, baseDelayMs, maxDelayMs), remaining);

    if (attempt > 0) {
      logger.debug("Poll", "Polling with backoff", {
        attempt: attempt + 1,
        delayMs,
        elapsedMs: elapsed,
      });
    }

    await sleep(delayMs);
    attempt++;
  }

  return { status: "timeout" };
}

/**
 * Try to execute a function with retry, returning undefined on failure.
 *
 * Unlike `withRetry`, this function:
 * - Returns `undefined` instead of throwing on failure
 * - Retries all errors by default (not just rate limits)
 * - Calls `onError` callback with the final error
 *
 * Useful for non-critical operations like sending messages where
 * failure should be handled gracefully without throwing.
 *
 * @param fn - Function to execute
 * @param onError - Callback for the final error after all retries exhausted
 * @param maxRetries - Maximum number of retries (default 1)
 * @param baseDelayMs - Base delay in milliseconds (default 1000)
 * @returns Result of the function or undefined on failure
 */
export async function tryWithRetry<T>(
  fn: () => Promise<T>,
  onError: (error: unknown) => void,
  maxRetries: number = 1,
  baseDelayMs: number = 1000,
): Promise<T | undefined> {
  try {
    return await withRetry(fn, maxRetries, baseDelayMs, () => true);
  } catch (error) {
    onError(error);
    return undefined;
  }
}
