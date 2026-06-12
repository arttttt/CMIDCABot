# Security Audit Notes

Result of an internal security review (2026-06-14) of the critical paths:
authorization chain, swap execution, confirmation flow, logging.

**Verdict:** no critical findings. Authorization cannot be bypassed and funds
cannot be moved without the owner's confirmation. The three observations below
are accepted risks for the current single-owner deployment; revisit them only
if the bot ever becomes multi-user.

## 1. Confirmation session: no lock between `get()` and `consume()`

`ConfirmationCache` reads a session (`get`) and consumes it (`consume`) as two
separate calls. Node's single-threaded event loop plus the in-memory cache make
the window harmless with one user: a parallel confirm of the same session loses
the race on `consume()` and gets "session not found".

**When it matters:** multiple users or a distributed cache. Fix would be an
atomic `getAndConsume()` on the repository.

## 2. Operation lock survives a mid-swap crash until TTL

`ExecuteSwapUseCase` releases the per-user balance lock in `finally`, but if
the process dies between `acquire` and `release`, the lock simply expires by
TTL (`BalanceOperationLock.TTL_MS`). Until then the user cannot start another
swap. Inconvenience, not a vulnerability: the lock is in-memory, so a process
restart clears it anyway — the stale-lock scenario only applies while the
process keeps running after an unhandled mid-swap failure.

**When it matters:** if swaps become frequent/automated. Options: shorter TTL
or releasing the lock in a process-level error handler.

## 3. Callback parameters validated by length/regex, not schema

`router.ts` validates callback parameters against `maxLength`, and session ids
additionally against `/^[A-Za-z0-9_-]{22}$/`. There is no declarative schema
validation beyond that. Injection surface is nil today: parameters only key
into in-memory maps, never reach SQL or shell.

**When it matters:** if callbacks ever carry user-shaped payloads or reach
persistent storage. Fix would be per-callback parameter schemas.

## Related hardening already in place

- Private keys: AES-256-GCM at rest, non-extractable master `CryptoKey`,
  decryption only at signing time, buffers zeroed after use.
- Invite tokens: stored as SHA-256 hashes; plaintext exists only in the link.
- One-time secret links: payload encrypted even in memory, 5 min TTL,
  single consumption.
- Logs: mnemonics/keys redacted by `LogSanitizer`; production logger is no-op.
- Swap guards: 0.01–50 USDC bounds, price impact ≤ 0.5%, slippage re-confirm
  capped at one retry, `decimal.js` with `ROUND_DOWN`.
