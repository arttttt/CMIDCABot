# Code Review: RateLimitPlugin

**Reviewed:**
- `/Users/artem/.claude-worktrees/DCATgBot/zen-shaw/src/domain/repositories/RateLimitRepository.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/zen-shaw/src/data/sources/memory/RateLimitCache.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/zen-shaw/src/data/repositories/memory/InMemoryRateLimitRepository.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/zen-shaw/src/presentation/protocol/gateway/plugins/RateLimitPlugin.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/zen-shaw/src/presentation/protocol/gateway/GatewayFactory.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/zen-shaw/src/infrastructure/shared/config/envSchema.ts`

**Date:** 2025-12-31
**Status:** 🟡 Approved with comments

## Summary

Solid implementation of rate limiting with proper Clean Architecture compliance. Sliding window algorithm is correctly implemented with appropriate lazy cleanup and periodic garbage collection. One edge case in the algorithm and minor inconsistencies in naming/type duplication warrant attention but are not blockers.

## Findings

### 🔴 Critical (must fix)

_No critical issues found._

### 🟡 Should Fix

#### [S1] Boundary condition in sliding window: exact timestamp match excluded

**Location:** `src/data/sources/memory/RateLimitCache.ts:61`
**Issue:** Filter uses `t > windowStart` (strict greater than), which excludes timestamps exactly at the window boundary. If a request happened exactly at `nowMs - windowMs`, it gets excluded from the count.
**Impact:** Minor inaccuracy in rate limiting - requests at exact boundary are not counted. In practice, unlikely to cause issues due to millisecond precision, but semantically incorrect for "last 60 seconds" logic.
**Suggestion:** Change to `t >= windowStart` for inclusive boundary, matching the standard sliding window semantic of "requests within the last N milliseconds".

```typescript
// Current (excludes boundary):
const validTimestamps = timestamps.filter((t) => t > windowStart);

// Suggested (includes boundary):
const validTimestamps = timestamps.filter((t) => t >= windowStart);
```

#### [S2] Duplicate RateLimitConfig type definition

**Location:**
- `src/presentation/protocol/gateway/plugins/RateLimitPlugin.ts:25-32`
- `src/infrastructure/shared/config/envSchema.ts:182-185`

**Issue:** `RateLimitConfig` interface is defined in two places with identical shape but different fields:
- Plugin version has `ownerTelegramId`
- Config version has only `windowMs` and `maxRequests`

The plugin's config includes `ownerTelegramId` which is actually an auth concern, not rate limit config.
**Impact:** Confusing API - caller must assemble different config objects. Harder to maintain if fields diverge.
**Suggestion:** Either:
1. Plugin should accept `RateLimitConfig` from envSchema + separate `ownerTelegramId`, or
2. Extend the shared config type to include owner ID, or
3. Rename plugin's config to `RateLimitPluginConfig` to clarify it's plugin-specific

#### [S3] Missing HTTP identity handling validation

**Location:** `src/presentation/protocol/gateway/plugins/RateLimitPlugin.ts:37-41`
**Issue:** For HTTP provider, key is `http:${identity.sessionId}`. If `sessionId` is empty string or undefined (type says string but runtime could differ), rate limiting becomes ineffective - all anonymous HTTP requests share same key.
**Impact:** Potential bypass for HTTP transport if session management has bugs.
**Suggestion:** Add defensive check:
```typescript
function getRateLimitKey(identity: UserIdentity): string {
  if (identity.provider === "telegram") {
    return `tg:${identity.telegramId}`;
  }
  if (!identity.sessionId) {
    return "http:anonymous"; // or throw error
  }
  return `http:${identity.sessionId}`;
}
```

### 🟢 Consider

#### [N1] RateLimitCache constructor accepts windowMs but checkAndRecord also requires it

**Location:** `src/data/sources/memory/RateLimitCache.ts:28-29, 51-56`
**Issue:** `windowMs` is passed to constructor (for periodic cleanup) AND to `checkAndRecord()` method. This allows inconsistent windows - cleanup uses one value while checks could use another.
**Impact:** Code clarity - confusing API. Not a bug if caller always passes same value.
**Suggestion:** Consider removing `windowMs` from `checkAndRecord()` signature and using only the constructor value, or document why both are needed.

#### [N2] Consider adding metrics/observability hook

**Location:** `src/data/sources/memory/RateLimitCache.ts`
**Issue:** The `size()` method exists for monitoring, but there's no easy way to track rate limit hits/misses for metrics dashboards.
**Impact:** Harder to tune rate limits in production without visibility into actual usage patterns.
**Suggestion:** Consider adding optional callback or event emission on limit exceeded for future metrics integration.

#### [N3] Repository interface could be async for future extensibility

**Location:** `src/domain/repositories/RateLimitRepository.ts:31-36`
**Issue:** `checkAndRecord` is synchronous. If switching to Redis in future, this would require interface change.
**Impact:** None currently (spec excludes Redis). Future extensibility concern only.
**Suggestion:** Consider making return type `Promise<RateLimitCheckResult>` for forward compatibility. This is a minor consideration since spec explicitly excludes Redis.

#### [N4] Plugin order comment in GatewayFactory is helpful but could be more explicit

**Location:** `src/presentation/protocol/gateway/GatewayFactory.ts:41-42`
**Issue:** Comment describes order but doesn't explain WHY RateLimit must come before LoadRole (to avoid DB hits for rate-limited requests).
**Impact:** Future maintainers might reorder plugins without understanding implications.
**Suggestion:** Add brief reasoning:
```typescript
// Plugin chain order (execution):
// Request -> ErrorBoundary -> RateLimit -> LoadRole -> GatewayCore -> Handlers
// Note: RateLimit before LoadRole to reject spam without DB access
```

## Architecture Compliance

| Rule | Status | Notes |
|------|--------|-------|
| Dependencies point inward | OK | Plugin -> Domain Repository interface |
| No business logic in Presentation | OK | Only orchestration, limit check delegated |
| Repository pattern | OK | Interface in domain, impl in data |
| Data sources by type | OK | RateLimitCache in sources/memory |
| Naming conventions | OK | *Cache, *Repository patterns followed |
| No `any` types | OK | All types explicit |
| No secrets in code | OK | Config via env |

## Acceptance Criteria Check

| Criteria | Status |
|----------|--------|
| RateLimitCache with checkAndRecord() | OK |
| RateLimitPlugin implements GatewayPlugin | OK |
| Plugin chain: ErrorBoundary -> RateLimit -> LoadRole | OK |
| 30 req/min configurable via env | OK |
| Owner whitelist without DB | OK |
| Generic message on limit exceeded | OK |
| Lazy cleanup on each request | OK |
| Periodic cleanup (5 min) | OK |
| Warn logging on exceeded | OK |
| .env.example updated | OK |

## Action Items

- [x] [S1] Fix boundary condition: change `t > windowStart` to `t >= windowStart`
- [x] [S2] Clarify/unify RateLimitConfig types between plugin and envSchema
- [x] [S3] Add defensive check for empty HTTP sessionId
- [x] [N1] Consider simplifying windowMs parameter passing (optional)
- [x] [N3] Make interface async for future extensibility
- [ ] [N4] Improve GatewayFactory comment explaining plugin order rationale (optional)
