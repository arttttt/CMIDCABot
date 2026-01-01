<!-- GitHub Issue: #196 -->
# Task: S-03 Input Size Limit + ShowWalletUseCase Rename

## Context

Two code quality improvements in wallet domain: (1) S-03 security fix to prevent DoS via oversized input to `ImportWalletUseCase`, and (2) naming consistency fix to rename `ShowWalletUseCase` to `GetWalletInfoUseCase` matching the established `Get*` pattern for read-only operations.

## Acceptance Criteria

- [ ] `ImportWalletUseCase.execute()` rejects input longer than 512 characters
- [ ] Rejection returns `{ type: "invalid_key" }` with no specific "too long" message
- [ ] Validation occurs before any string processing (trim, split, regex)
- [ ] `ShowWalletUseCase.ts` renamed to `GetWalletInfoUseCase.ts`
- [ ] Class renamed from `ShowWalletUseCase` to `GetWalletInfoUseCase`
- [ ] Type renamed from `ShowWalletResult` to `GetWalletInfoResult`
- [ ] Export in `src/domain/usecases/index.ts` updated
- [ ] Import and usage in `src/presentation/commands/handlers.ts` updated
- [ ] Logger tags updated from "ShowWallet" to "GetWalletInfo"
- [ ] All imports compile without errors (`npm run build` passes)

## Scope

- Add input length validation (512 chars) in `ImportWalletUseCase`
- Rename `ShowWalletUseCase` -> `GetWalletInfoUseCase` (file, class, logger)
- Rename `ShowWalletResult` -> `GetWalletInfoResult` in types
- Update all imports and exports referencing renamed entities

## Out of Scope

- Changing HTTP body limit in `ImportPageHandler` (already 10KB)
- Adding new tests (unless explicitly requested)
- Refactoring `ImportWalletUseCase` logic beyond the validation check
- Renaming other use cases or types

## Technical Notes

**S-03 implementation hint:**
```typescript
const MAX_INPUT_LENGTH = 512;

async execute(telegramId: TelegramId, privateKeyBase64: string): Promise<ImportWalletResult> {
  if (privateKeyBase64.length > MAX_INPUT_LENGTH) {
    return { type: "invalid_key" };
  }
  // ... existing logic
}
```

**Files to update for rename:**
1. `src/domain/usecases/ShowWalletUseCase.ts` -> `GetWalletInfoUseCase.ts`
2. `src/domain/usecases/types.ts` - rename `ShowWalletResult`
3. `src/domain/usecases/index.ts` - update export
4. `src/presentation/commands/handlers.ts` - update import and usage
