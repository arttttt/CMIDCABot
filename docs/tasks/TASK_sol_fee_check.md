<!-- GitHub Issue: #198 -->
# Task: SOL Fee Balance Check

## Context

Users receive a generic "Transaction failed" error when attempting swaps without sufficient SOL for transaction fees. The USDC balance is validated, but SOL balance for fees is not checked. This causes confusion as the actual failure reason is unclear.

The validation pattern already exists in `ExecuteBatchDcaUseCase` (lines 48-57) and should be applied to interactive swap operations.

## Acceptance Criteria

- [x] Create `src/domain/constants.ts` with `MIN_SOL_FOR_FEES = 0.01`
- [x] Rename `insufficient_balance` → `insufficient_usdc_balance` in `SwapResult` (`src/domain/models/SwapStep.ts`)
- [x] Rename `insufficient_balance` → `insufficient_usdc_balance` in `PurchaseResult` (`src/domain/usecases/types.ts`)
- [x] Add `insufficient_sol_balance` status to `SwapResult`
- [x] Add `insufficient_sol_balance` status to `PurchaseResult`
- [x] Update all usages of `insufficient_balance` → `insufficient_usdc_balance` in use cases and formatters
- [x] Add SOL balance check in `ExecuteSwapUseCase` after USDC validation, before quote
- [x] Add SOL balance check in `ExecutePurchaseUseCase` after USDC validation, before quote
- [x] Update error message for `insufficient_usdc_balance`: "Insufficient USDC balance"
- [x] Add error message for `insufficient_sol_balance`: "Insufficient SOL for transaction fees"
- [x] Build passes without errors
- [ ] Manual test: swap with USDC < amount shows "Insufficient USDC balance"
- [ ] Manual test: swap with SOL < 0.01 shows "Insufficient SOL for transaction fees"

## Scope

- SOL balance validation before swap operations
- New result status for insufficient SOL
- User-facing error messages in English

## Out of Scope

- Showing exact required/available amounts in error message
- Dynamic fee calculation based on priority fees
- Changes to `ExecuteBatchDcaUseCase` (already has validation)

## Technical Notes

- Use `BalanceRepository.getSolBalance()` — already available
- Check SOL balance after USDC validation, before calling Jupiter quote
- Follow existing pattern from `ExecuteBatchDcaUseCase:48-57`
- Status naming convention: `insufficient_<token>_balance` for balance errors (e.g., `insufficient_usdc_balance`, `insufficient_sol_balance`)
