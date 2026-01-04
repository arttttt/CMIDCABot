# Task: Unified Slippage Configuration

<!-- GitHub Issue: #213 -->

## Context

The system currently has inconsistent slippage values: 50 bps for quotes and 300 bps for swap transactions. This causes a mismatch where users see 0.5% slippage in preview, but transactions can execute with up to 3% deviation. Unifying to 50 bps ensures consistency between displayed and actual slippage.

## Acceptance Criteria

- [x] `dynamicSlippage.maxBps` changed from 300 to 50
- [x] Comment updated: `// Max 0.5% slippage`
- [x] `npm run build` passes

## Scope

- `src/data/sources/api/JupiterSwapClient.ts:243`

## Out of Scope

- Quote slippage (already 50 bps)
- SlippageCalculator
- Tests
- Configurable slippage (env variable or user setting)
- Retry logic for failed transactions

## Technical Notes

**File:** `src/data/sources/api/JupiterSwapClient.ts`

**Change location:** Inside `buildSwapTransaction()` method, line 243

```typescript
// Before
dynamicSlippage: { maxBps: 300 }, // Max 3% slippage

// After
dynamicSlippage: { maxBps: 50 }, // Max 0.5% slippage
```

**Risk consideration:** With tighter slippage, transactions may fail during high volatility. For typical volumes (~6 USDC) and liquid pairs (SOL, cbBTC, wETH), this risk is minimal. User can retry manually if transaction fails.
