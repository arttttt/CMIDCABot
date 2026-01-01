/**
 * RateLimitRepository - interface for rate limiting storage
 *
 * Tracks request timestamps per user to enforce rate limits.
 * Used by RateLimitPlugin in Gateway.
 */

/**
 * Result of checking rate limit
 */
export interface RateLimitCheckResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current request count in window */
  count: number;
}

/**
 * Rate limit repository interface
 */
export interface RateLimitRepository {
  /**
   * Check if request is allowed and record it if so
   *
   * @param key - Rate limit key (e.g., "tg:123456")
   * @param nowMs - Current timestamp in milliseconds
   * @returns Check result with allowed flag and current count
   */
  checkAndRecord(key: string, nowMs: number): Promise<RateLimitCheckResult>;
}
