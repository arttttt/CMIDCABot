<!-- GitHub Issue: #189 -->
# Task: Branded Types for IDs

## Context
The project uses primitive types (`number`, `string`) for semantically distinct identifiers, creating risk of accidental type substitution that the compiler cannot catch. Introducing branded types provides compile-time safety while maintaining zero runtime overhead after validation.

## Acceptance Criteria
- [ ] Created `src/domain/models/id/` directory with branded type files
- [ ] `TelegramId` type and `telegramId()` constructor with validation (positive integer)
- [ ] `TxSignature` type and `txSignature()` constructor with validation (87-88 chars base58)
- [ ] `WalletAddress` type and `walletAddress()` constructor with validation (32-44 chars base58)
- [ ] `TokenMint` type and `tokenMint()` constructor with validation (32-44 chars base58)
- [ ] `RequestId` type and `requestId()` constructor with validation (UUID format)
- [ ] `SessionId` type and `sessionId()` constructor with validation (non-empty string)
- [ ] `index.ts` re-exports all types and constructors
- [ ] All domain models migrated to use branded types
- [ ] All repository interfaces migrated to use branded types
- [ ] All repository implementations migrated to use branded types
- [ ] All use cases migrated to use branded types
- [ ] All presentation layer code migrated to use branded types
- [ ] `conventions.md` updated with Branded Types section and Structure exception
- [ ] Project compiles without type errors
- [ ] All existing tests pass

## Scope

### Included
- 6 branded types: `TelegramId`, `TxSignature`, `WalletAddress`, `TokenMint`, `RequestId`, `SessionId`
- Constructor functions with mandatory validation (no unsafe constructors)
- Migration of all layers: domain, data, application, presentation
- Update to `conventions.md` with new rules

### File Structure
```
src/domain/models/id/
├── TelegramId.ts
├── TxSignature.ts
├── WalletAddress.ts
├── TokenMint.ts
├── RequestId.ts
├── SessionId.ts
└── index.ts
```

### Migration Scope

**TelegramId (~30 files):**
- `src/domain/models/User.ts` — all user types
- `src/domain/models/AuthorizedUser.ts`
- `src/domain/models/Transaction.ts`
- `src/domain/models/Purchase.ts`
- `src/domain/models/Portfolio.ts`
- `src/domain/models/InviteToken.ts` — `createdBy`, `usedBy` fields
- `src/domain/models/UserIdentity.ts`
- `src/domain/repositories/` — all interfaces
- `src/application/usecases/` — all use cases
- `src/data/repositories/` — all implementations
- `src/data/types/database.ts` — `telegram_id` fields
- `src/data/types/authDatabase.ts` — `telegram_id`, `added_by`, `created_by`, `used_by`
- `src/presentation/` — adapters and handlers

**TxSignature (~5 files):**
- `src/domain/models/Transaction.ts` — `txSignature`
- `src/domain/models/SwapStep.ts` — `signature`
- `src/domain/usecases/types.ts` — `PurchaseResult.signature`
- `src/domain/repositories/BlockchainRepository.ts` — `SendTransactionResult`
- `src/data/repositories/SQLiteTransactionRepository.ts`
- `src/data/sources/api/SolanaRpcClient.ts`

**WalletAddress (~15 files):**
- `src/domain/models/User.ts` — `walletAddress` fields
- `src/domain/models/UserWithWallet.ts`
- `src/domain/models/ActiveDcaUser.ts`
- `src/domain/usecases/types.ts` — `WalletInfo.address`
- `src/domain/repositories/UserRepository.ts`
- `src/domain/repositories/BalanceRepository.ts`
- `src/domain/repositories/BlockchainRepository.ts` — `GeneratedKeypair.address`
- `src/domain/repositories/SwapRepository.ts` — `userPublicKey`
- `src/data/repositories/` — relevant implementations
- `src/data/sources/api/SolanaRpcClient.ts`

**TokenMint (~10 files):**
- `src/infrastructure/shared/config/tokens.ts` — `TokenConfig.mint`, `TOKEN_MINTS`
- `src/domain/models/Token.ts`
- `src/domain/models/Balance.ts`
- `src/domain/models/Portfolio.ts`
- `src/domain/repositories/SwapRepository.ts` — `inputMint`, `outputMint`
- `src/domain/repositories/BlockchainRepository.ts`
- `src/data/sources/api/JupiterSwapClient.ts`
- `src/data/sources/api/SolanaRpcClient.ts`

**RequestId (~5 files):**
- `src/presentation/protocol/gateway/GatewayContext.ts`
- `src/presentation/commands/CommandExecutionContext.ts`
- `src/presentation/protocol/gateway/Gateway.ts`
- `src/presentation/protocol/gateway/plugins/RateLimitPlugin.ts`
- `src/presentation/protocol/gateway/plugins/ErrorBoundaryPlugin.ts`

**SessionId (~3 files):**
- `src/domain/models/UserIdentity.ts`
- `src/presentation/protocol/gateway/plugins/RateLimitPlugin.ts`
- Related HTTP adapter code

## Out of Scope
- `userId` in presentation layer — remains string for adapter compatibility, explicit conversion to TelegramId
- `InviteToken.token` field — isolated context, can be added later

## Technical Notes

### Brand Pattern
```typescript
// src/domain/models/id/TelegramId.ts
declare const __brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type TelegramId = Brand<number, 'TelegramId'>;

export function telegramId(value: number): TelegramId {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid Telegram ID: ${value}`);
  }
  return value as TelegramId;
}
```

### Validation Rules
| Type | Validation |
|------|------------|
| `TelegramId` | positive integer |
| `TxSignature` | regex `/^[1-9A-HJ-NP-Za-km-z]{87,88}$/` |
| `WalletAddress` | regex `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/` |
| `TokenMint` | regex `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/` |
| `RequestId` | regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` |
| `SessionId` | non-empty string |

### conventions.md Changes

**1. Update Structure section:**
```markdown
### Structure
- Small modules — single responsibility
- Utility functions — class with static methods (not top-level exports)
- **Exception:** branded type constructors — top-level functions allowed (see Branded Types)
```

**2. Add new section after Security:**
```markdown
## Branded Types for IDs

All identifiers must use branded types from `src/domain/models/id/`:

| Type | Base | Usage |
|------|------|-------|
| `TelegramId` | `number` | Telegram user ID |
| `TxSignature` | `string` | Solana transaction signature |
| `WalletAddress` | `string` | Solana wallet address |
| `TokenMint` | `string` | SPL token mint address |
| `RequestId` | `string` | Request tracing UUID |
| `SessionId` | `string` | HTTP session identifier |

**Prohibited:** using primitives (`number`, `string`) for IDs directly.

When adding a new ID type:
1. Create file in `src/domain/models/id/<TypeName>.ts`
2. Define branded type and constructor with validation
3. Add re-export to `index.ts`
4. Update this table
```

### Implementation Order
All changes in single branch/PR. Suggested order:
1. Create `src/domain/models/id/` files with all 6 types
2. Update `conventions.md`
3. Migrate TelegramId (widest usage, will surface most issues)
4. Migrate RequestId and SessionId (presentation layer)
5. Migrate TxSignature (isolated in blockchain layer)
6. Migrate WalletAddress
7. Migrate TokenMint
8. Verify compilation and tests
