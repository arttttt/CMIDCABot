<!-- GitHub Issue: #221 -->
# Task: Price Impact Validation

## Context

Price impact (`priceImpactPct`) is parsed from Jupiter API but not validated before swap execution. Unlike slippage (market price change between quote and execution), price impact measures how much your order moves the market price due to insufficient liquidity. Without validation, DCA purchases on low-liquidity wrapped tokens (cbBTC, wETH) can lose 2-10% per transaction, accumulating significant losses over time.

## Acceptance Criteria

- [x] Constant `MAX_PRICE_IMPACT_BPS = 50` added to `src/domain/constants.ts`
- [x] New status `high_price_impact` with `priceImpactPct: number` added to `SwapResult` union in `src/domain/models/SwapStep.ts`
- [x] Price impact check added in `ExecuteSwapUseCase.ts` after quote received (before `buildSwapTransaction`)
- [x] When `priceImpactPct * 100 > MAX_PRICE_IMPACT_BPS`, swap yields `completed` with `high_price_impact` status and returns
- [x] Warning logged via `logger.warn` when price impact exceeds limit
- [x] `SwapFormatter.ts` handles `high_price_impact` status with user-friendly message showing actual vs max allowed percentage
- [x] `PurchaseResult.type` in `src/domain/usecases/types.ts` includes `high_price_impact`
- [x] `ExecutePurchaseUseCase.ts` maps `high_price_impact` swap result to purchase result

## Scope

- Single price impact limit (50 bps / 0.5%) for all assets
- Hard fail behavior — transaction rejected, no confirmation prompt
- Validation in `ExecuteSwapUseCase` following existing amount validation pattern
- User message includes actual price impact and maximum allowed

## Out of Scope

- Per-asset price impact limits
- Warning mode with user confirmation
- Route complexity analysis
- Configurable limits (env variable or user setting)
- Logging-only mode without blocking

## Technical Notes

**Validation location:** After line 177 in `ExecuteSwapUseCase.ts` (after quote received, before `buildSwapTransaction`).

**Conversion:** `priceImpactPct` from Jupiter is already a percentage (e.g., 0.5 means 0.5%). Convert to bps: `priceImpactPct * 100`.

**Pattern reference:** Follow existing amount validation pattern (lines 64-86) — early return with `SwapSteps.completed()`.

**User message example:**
```
Price impact too high: 2.50%
Maximum allowed: 0.5%

This usually means low liquidity. Try a smaller amount.
```
