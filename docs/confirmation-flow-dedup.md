# Deferred refactor: deduplicate the confirmation flow

Status: **not implemented** — design recorded for later. Surfaced by the
2026-06 code review. Deferred deliberately: it touches the money path
(swap/purchase) and the project has no tests, so it warrants a careful,
isolated change rather than being bundled with other fixes.

## Where the duplication is

`PortfolioCommand` (`/portfolio buy`) and `SwapCommand` (`/swap execute`)
run the same confirmation flow with near-identical code:

| Fragment | Swap | Portfolio | Identical? |
|---|---|---|---|
| `parseAmount` (module fn) | yes | yes | byte-for-byte |
| `parseSessionId` | yes | yes | byte-for-byte |
| `handleCancel` | yes | yes | identical except log tag |
| confirm prelude: parse → get → ownership check | yes | yes | identical (`confirmationFormatter.formatSessionNotFound()`) |
| slippage: freshQuote → `isExceeded` → `updateQuote`/`maxExceeded` → `consume` | yes | yes | ~identical |
| preview: quote → `store` → `formatPreview` | ×2 (handler + stream) | ×2 | near-identical; Portfolio adds `determineAssetToBuy` |

A change to the slippage/re-confirm logic currently has to be made in two
places and can silently drift.

## Why a full merge is not possible

These differences must be preserved — do **not** flatten them:

1. **Swap confirm is synchronous** (`handler` returning a `ClientResponse`);
   **Portfolio confirm is streaming** (`streamingHandler` yielding progress
   via `progressFormatter`). Making swap stream would change its UX.
2. **Execution differs**: swap awaits `executeSwap` and formats a
   `SwapResult`; portfolio streams `executePurchase` steps. This is the
   riskiest code and should stay in each command.
3. **`quote_error` is formatted per-command** (`swapFormatter` /
   `purchaseFormatter`), not via the shared `confirmationFormatter`.

## Proposed design

Introduce `src/presentation/commands/ConfirmationFlow.ts` — a small
presentation-layer helper, constructor-injected with
`confirmationRepository`, `confirmationFormatter`, `swapRepository`, and a
`logComponent` string. It exposes only the parts that produce a
`ClientResponse` (never a stream — that is what decouples the sync/stream
split):

- `resolveSession(sessionIdStr, telegramId)` →
  `{ ok: true; session; sessionId }` | `{ ok: false; response }`
  (parse + get + ownership; failures use the shared `confirmationFormatter`).
- `guardSlippageAndConsume(session, sessionId)` → discriminated outcome:
  - `{ kind: "proceed" }` — session consumed, caller may execute;
  - `{ kind: "terminal"; response }` — slippage warning / max-exceeded
    (shared formatter);
  - `{ kind: "quoteError" }` — caller formats with its own formatter.
- `cancel(sessionIdStr, telegramId)` → `ClientResponse` (fully shared).

Each command stays thin: call the helper, then `return` (swap) or
`yield { mode: "final" }` (portfolio) on a terminal/error outcome, and run
its own money path on `proceed`. `parseAmount` moves to a shared util.

### Explicitly out of scope

- The bodies of `executeSwap` / `executePurchase` and the
  `consume → execute` ordering.
- Splitting the preview step across commands (blocked by
  `determineAssetToBuy`, which is Portfolio-only).

## Suggested commit breakdown (when picked up)

1. extract shared `parseAmount` util;
2. add `ConfirmationFlow` (resolveSession / guardSlippageAndConsume / cancel);
3. route `SwapCommand` through it;
4. route `PortfolioCommand` through it.

Build + a manual smoke of `/swap execute` and `/portfolio buy`
(confirm, cancel, slippage re-confirm) on each step, since there are no
automated tests.
