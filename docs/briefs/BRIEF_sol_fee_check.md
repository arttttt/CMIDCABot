<!-- GitHub Issue: #198 -->
# SOL Fee Balance Check

## Problem Statement

`ExecuteSwapUseCase` and `ExecutePurchaseUseCase` only validate USDC balance before swap, but do not check SOL balance for transaction fees. When SOL balance is insufficient (~0.01 SOL needed), the transaction fails with a generic "Transaction failed" error, leaving users confused about the actual cause.

The pattern for SOL balance validation already exists in `ExecuteBatchDcaUseCase` (lines 48-57) but was not applied to interactive swaps.

## Technical Context

### Files to Modify

| File | Change |
|------|--------|
| `src/domain/usecases/ExecuteSwapUseCase.ts` | Add SOL balance check after USDC validation |
| `src/domain/usecases/ExecutePurchaseUseCase.ts` | Add SOL balance check |
| `src/domain/models/SwapStep.ts` | Add `insufficient_sol_for_fees` status to `SwapResult` |
| `src/domain/usecases/types.ts` | Add `insufficient_sol_for_fees` status to `PurchaseResult` |
| `src/presentation/formatters/SwapFormatter.ts` | Add error message for new status |
| `src/presentation/formatters/PurchaseFormatter.ts` | Add error message for new status |

### Existing Infrastructure

- `BalanceRepository.getSolBalance()` — ready to use
- `ExecuteBatchDcaUseCase` — reference implementation (lines 48-57)
- Constant `MIN_SOL = 0.01` — to be added in `tokens.ts`

## UI Requirement

Users must see distinct error messages depending on the failure cause:

| Situation | Message |
|-----------|---------|
| Insufficient source token | "Insufficient USDC balance" |
| Insufficient SOL for fees | "Insufficient SOL for transaction fees" |

This requires separate result statuses:
- `insufficient_balance` (existing) — for source token
- `insufficient_sol_for_fees` (new) — for transaction fees

## Open Questions

1. Is MIN_SOL = 0.01 SOL sufficient for all cases?
2. Task priority relative to other work?
