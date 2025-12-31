/**
 * InMemoryRateLimitRepository - repository implementation for rate limiting
 *
 * Wraps RateLimitCache data source and implements RateLimitRepository interface.
 */

import type {
  RateLimitRepository,
  RateLimitCheckResult,
} from "../../../domain/repositories/RateLimitRepository.js";
import type { RateLimitCache } from "../../sources/memory/RateLimitCache.js";

export class InMemoryRateLimitRepository implements RateLimitRepository {
  constructor(private readonly cache: RateLimitCache) {}

  checkAndRecord(
    key: string,
    nowMs: number,
    windowMs: number,
    maxRequests: number,
  ): RateLimitCheckResult {
    return this.cache.checkAndRecord(key, nowMs, windowMs, maxRequests);
  }
}
