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
      const delayMs = baseDelayMs * Math.pow(2, attempt);
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
