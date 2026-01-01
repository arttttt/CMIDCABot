<!-- GitHub Issue: #196 -->
# Brief: S-03 Input Size Limit + ShowWalletUseCase Rename

## Problem Statement

Two related code quality issues in wallet domain:

1. **S-03: DoS via large payload** - `ImportWalletUseCase` accepts input without size validation, enabling potential denial-of-service through memory exhaustion
2. **Naming inconsistency** - `ShowWalletUseCase` uses "Show" verb while other read-only use cases use "Get" prefix (e.g., `GetBalanceUseCase`, `GetPortfolioStatusUseCase`)

## Technical Context

### S-03: Input Size Limit

**Entry points:**
- `src/presentation/web/ImportPageHandler.ts` - HTTP handler with 10KB body limit (line 175)
- Direct `ImportWalletUseCase.execute()` calls - no protection

**Data flow:**
```
HTTP POST -> readBody (10KB limit) -> ImportWalletUseCase.execute(telegramId, secretInput)
                                             |
                                             v
                                      privateKeyBase64.trim().split(/\s+/)
                                             |
                                             v
                             blockchainRepository.validateMnemonic/validatePrivateKey
```

**Valid input sizes:**
- Mnemonic: 12-24 words, ~100-250 characters max
- Base64 private key: 44 bytes (32-byte seed) or 88 bytes (64-byte full key)
- Maximum legitimate input: ~300 characters

**Existing protections:**
- `ImportPageHandler.readBody()` - 10KB HTTP body limit
- `TelegramAdapter` - callback data max 64 chars (SEC-03)

**Missing protection:**
- UseCase-level validation before expensive operations (split, regex, BIP39 validation)

### ShowWalletUseCase Analysis

**Current behavior:**
- Fetches wallet info (address + balance) for a user
- Returns `WalletInfo` with address and balance
- Read-only operation, no mutations

**Naming convention in codebase:**
| Pattern | Examples |
|---------|----------|
| `Get*UseCase` | `GetBalanceUseCase`, `GetPortfolioStatusUseCase`, `GetPricesUseCase`, `GetQuoteUseCase`, `GetDcaStatusUseCase` |
| `Show*UseCase` | `ShowWalletUseCase` (only one) |
| `Execute*UseCase` | `ExecuteSwapUseCase`, `ExecutePurchaseUseCase` |
| `Create/Delete/Import/Export*UseCase` | CRUD operations |

**Recommendation:** Rename to `GetWalletInfoUseCase`
- Consistent with `Get*` pattern for read-only queries
- "Info" suffix clarifies it returns wallet details, not just existence check

## Suggested Approach

### S-03: Add input size validation

Add early return in `ImportWalletUseCase.execute()`:

```typescript
// Maximum input size: 512 chars covers 24-word mnemonic with extra whitespace
const MAX_INPUT_LENGTH = 512;

async execute(telegramId: TelegramId, privateKeyBase64: string): Promise<ImportWalletResult> {
  // Early validation before any processing
  if (privateKeyBase64.length > MAX_INPUT_LENGTH) {
    return { type: "invalid_key", error: "Input too long" };
  }
  // ... existing logic
}
```

### Rename: ShowWalletUseCase -> GetWalletInfoUseCase

Files to update:
1. `src/domain/usecases/ShowWalletUseCase.ts` -> `GetWalletInfoUseCase.ts`
2. `src/domain/usecases/index.ts` - export
3. `src/domain/usecases/types.ts` - `ShowWalletResult` -> `GetWalletInfoResult`
4. `src/presentation/commands/handlers.ts` - import and usage
5. Logger tags: "ShowWallet" -> "GetWalletInfo"

## Trade-offs

### S-03

| Option | Pros | Cons |
|--------|------|------|
| UseCase-level validation | Defense in depth, protects all callers | Slight code duplication with HTTP handler |
| Handler-only validation | Single point of validation | Future callers unprotected |

**Recommendation:** UseCase-level - defense in depth is worth minor duplication.

### Rename

| Option | Pros | Cons |
|--------|------|------|
| `GetWalletInfoUseCase` | Consistent with Get* pattern, clear intent | Breaking change, multiple file updates |
| `GetWalletUseCase` | Shorter | Might imply returning Wallet entity, not info |
| Keep `ShowWalletUseCase` | No changes needed | Inconsistent naming |

**Recommendation:** `GetWalletInfoUseCase` - consistency improves maintainability.

## Open Questions for PM

1. **S-03 limit value:** Is 512 chars sufficient, or should we use a rounder number (500, 1024)?
2. **Error message:** Should we expose "Input too long" or use generic "Invalid key"?
3. **Rename scope:** Should we also rename `ShowWalletResult` to `GetWalletInfoResult` for full consistency?
4. **Priority:** Can these be combined in one PR or should they be separate?

## References

- `/Users/artem/.claude-worktrees/DCATgBot/busy-sanderson/src/domain/usecases/ImportWalletUseCase.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/busy-sanderson/src/domain/usecases/ShowWalletUseCase.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/busy-sanderson/src/presentation/web/ImportPageHandler.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/busy-sanderson/src/presentation/commands/handlers.ts`

## Estimated Effort

- S-03: ~15 min (add validation + test)
- Rename: ~30 min (file rename + find/replace + verify imports)
