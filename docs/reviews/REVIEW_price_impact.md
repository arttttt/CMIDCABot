<!-- GitHub Issue: #221 -->
# Code Review: Price Impact Validation

**Reviewed:**
- `src/domain/constants.ts`
- `src/domain/models/SwapStep.ts`
- `src/domain/usecases/ExecuteSwapUseCase.ts`
- `src/presentation/formatters/SwapFormatter.ts`
- `src/domain/usecases/types.ts`
- `src/domain/usecases/ExecutePurchaseUseCase.ts`

**Date:** 2026-01-06
**Status:** 🟡 Approved with comments

## Summary

Implementation correctly adds price impact validation to prevent DCA purchases on low-liquidity tokens. All acceptance criteria are met. The validation logic is placed correctly (after quote, before transaction build), follows existing patterns, and integrates cleanly with the streaming architecture. One minor issue with hardcoded value in formatter should be addressed.

## Findings

### 🟡 Should Fix

#### [S1] Hardcoded MAX_PRICE_IMPACT_BPS in SwapFormatter
**Location:** `src/presentation/formatters/SwapFormatter.ts:56`
**Issue:** The maximum allowed percentage is hardcoded as `"0.5"` instead of being derived from `MAX_PRICE_IMPACT_BPS` constant.
**Impact:** If `MAX_PRICE_IMPACT_BPS` changes in `constants.ts`, the user message will show incorrect maximum value. This creates a maintenance burden and potential for inconsistency.
**Suggestion:** Import `MAX_PRICE_IMPACT_BPS` from domain constants and compute `maxPct = (MAX_PRICE_IMPACT_BPS / 100).toFixed(1)`.

### 🟢 Consider

#### [N1] Quote is emitted before price impact validation
**Location:** `src/domain/usecases/ExecuteSwapUseCase.ts:180-203`
**Issue:** The quote is yielded to the user (lines 180-188) before price impact validation (lines 190-203). This means the user sees the quote briefly before seeing the rejection.
**Impact:** Minor UX inconsistency - user sees quote then rejection. However, this is acceptable because:
1. The quote display includes `priceImpactPct`, so user sees the problematic value
2. Reordering would require restructuring the streaming flow
3. Current behavior provides transparency about why swap was rejected
**Suggestion:** Consider this acceptable as-is. The quote display gives context for the rejection.

#### [N2] PurchaseResult.error duplicates information
**Location:** `src/domain/usecases/ExecutePurchaseUseCase.ts:160`
**Issue:** When mapping `high_price_impact`, the error message duplicates the price impact percentage that's already available in the swap result.
**Impact:** Minor redundancy. The formatted error string is constructed here but could be deferred to presentation layer.
**Suggestion:** Consider passing `priceImpactPct` in `PurchaseResult` directly (add optional field) rather than formatting error string in use case. However, current approach is consistent with other error mappings in the same method.

## Acceptance Criteria Verification

| Criteria | Status | Location |
|----------|--------|----------|
| Constant `MAX_PRICE_IMPACT_BPS = 50` | OK | `constants.ts:28` |
| Status `high_price_impact` with `priceImpactPct` | OK | `SwapStep.ts:46` |
| Check in ExecuteSwapUseCase after quote | OK | `ExecuteSwapUseCase.ts:190-203` |
| Yield completed and return when exceeded | OK | `ExecuteSwapUseCase.ts:198-202` |
| Warning via `logger.warn` | OK | `ExecuteSwapUseCase.ts:193-197` |
| SwapFormatter handles status | OK | `SwapFormatter.ts:54-62` |
| PurchaseResult.type includes status | OK | `types.ts:24` |
| ExecutePurchaseUseCase maps status | OK | `ExecutePurchaseUseCase.ts:159-160` |

## Architecture Compliance

| Rule | Status | Notes |
|------|--------|-------|
| Dependencies point inward | OK | Domain constants used by domain use case |
| No business logic in Presentation | OK | Formatter only formats, validation in use case |
| Use cases return domain objects | OK | SwapResult is domain model |
| Explicit dependencies | OK | Constants imported explicitly |

## Action Items

- [ ] [S1] Replace hardcoded `"0.5"` in SwapFormatter with computed value from `MAX_PRICE_IMPACT_BPS`
