# Confirmation flow — resolved (2026-07)

Status: **implemented**. The duplication recorded here in 2026-06 was
resolved by moving the confirmation flow into domain use cases rather
than the presentation-layer helper originally proposed.

## What exists now

- `ResolveConfirmationSessionUseCase` — shared prelude for both trades:
  session lookup, ownership check, quote refresh, slippage re-confirm
  policy, and consume-on-success. Also fixes a latent display bug: the
  slippage warning used to show the already-updated quote as the
  "original" one (the repository hands out live references and
  `updateQuote` mutates them); the original quote is now captured
  before the update.
- `ConfirmSwapUseCase` / `ConfirmPurchaseUseCase` — resolve + execute.
  After the session is consumed it is never cancelled: an unexpected
  failure surfaces as a `send_error` result instead of a generic
  message that could mask an already-on-chain transaction.
- `PrepareSwapConfirmationUseCase` / `PreparePurchaseConfirmationUseCase`
  — preview: input validation via `SwapValidationPolicy`, quote fetch,
  session creation.
- `CancelConfirmationUseCase` — shared cancel with ownership check.

`SwapCommand` and `PortfolioCommand` are now thin adapters: they parse
input (amount, session id) at the boundary and map use-case outcomes to
formatter calls. The pacing difference is preserved deliberately: swap
confirm renders a single final message, portfolio confirm streams
purchase progress.
