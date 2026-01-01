<!-- GitHub Issue: #189 -->
# Code Review: Branded Types

**Reviewed:**
- `src/domain/models/id/TelegramId.ts`
- `src/domain/models/id/WalletAddress.ts`
- `src/domain/models/id/TxSignature.ts`
- `src/domain/models/id/TokenMint.ts`
- `src/domain/models/id/RequestId.ts`
- `src/domain/models/id/SessionId.ts`
- `src/domain/models/id/index.ts`
- Usage across domain, data, presentation layers

**Date:** 2026-01-01
**Status:** 🟡 Approved with comments

## Summary

Implementation deviates from TASK specification (class-based vs function-based approach), which is an acceptable design decision. Core branded types are correctly implemented with validation. However, `RequestId` and `SessionId` are not actually used in the codebase despite being defined. There is also a critical equality comparison bug in `AuthorizationHelper` and incomplete migration in `SecretStoreRepository`.

## Findings

### 🔴 Critical (must fix)

#### [C1] Object equality comparison bug in AuthorizationHelper
**Location:** `src/domain/helpers/AuthorizationHelper.ts:38, 55, 74`
**Issue:** Class instances are compared using `===` which compares references, not values. Two `TelegramId` instances with the same numeric value will not be equal.
**Impact:** Owner authorization check always fails unless the exact same object instance is reused. This breaks owner privilege checks.
**Suggestion:** Compare `.value` properties: `id.value === this.ownerTelegramIdBranded.value`

### 🟡 Should Fix

#### [S1] SecretStoreRepository interface uses primitive `number` instead of TelegramId
**Location:** `src/domain/repositories/SecretStoreRepository.ts:18`
**Issue:** Interface signature `store(payload: string, telegramId: number)` uses primitive `number` instead of branded `TelegramId`. Same issue in implementations: `SecretCache.ts:55`, `InMemorySecretRepository.ts:13`.
**Impact:** Breaks type safety at domain boundary. Callers must extract `.value` manually.
**Suggestion:** Update interface to use `TelegramId`, implementations to accept branded type, extract `.value` internally for storage.

#### [S2] RequestId type defined but never instantiated
**Location:** `src/domain/models/id/RequestId.ts`, `src/presentation/protocol/gateway/GatewayContext.ts:11`, `src/presentation/commands/CommandExecutionContext.ts:14`
**Issue:** `RequestId` class exists but `GatewayContext` and `CommandExecutionContext` use `requestId: string` directly. Per TASK spec, RequestId should be used in these locations.
**Impact:** Incomplete migration leaves type safety gap for request tracing.
**Suggestion:** Update `GatewayContext` and `CommandExecutionContext` to use `RequestId` branded type.

#### [S3] SessionId used in type definition but never constructed
**Location:** `src/domain/models/UserIdentity.ts:11`
**Issue:** `SessionId` is referenced in `UserIdentity` type but no code path constructs `{ provider: "http", sessionId: SessionId }`. The type exists only for future HTTP transport.
**Impact:** Dead code. If HTTP transport is implemented later, developers may not know to use `new SessionId()`.
**Suggestion:** Either document this as intentional placeholder, or remove until HTTP transport is implemented to reduce confusion.

#### [S4] Design deviation from TASK specification
**Location:** All `src/domain/models/id/*.ts` files
**Issue:** TASK specifies function-based approach with `type Brand<T, B>` pattern and `telegramId()` factory functions. Implementation uses class-based approach with `class TelegramId { constructor(readonly value: T) }`.
**Impact:** Class approach is valid and provides better encapsulation, but deviates from spec. Should be explicitly documented in conventions.md that class-based approach was chosen.
**Suggestion:** Update `conventions.md` Branded Types section to explicitly document the class-based pattern decision.

### 🟢 Consider

#### [N1] Missing convenience method for TelegramId equality
**Location:** `src/domain/models/id/TelegramId.ts`
**Issue:** No `equals(other: TelegramId): boolean` method for safe comparison.
**Impact:** Developers must remember to compare `.value` properties, prone to [C1]-type bugs.
**Suggestion:** Add `equals(other: TelegramId): boolean { return this.value === other.value; }` method to all branded types.

#### [N2] Inconsistent validation message formatting
**Location:** `src/domain/models/id/SessionId.ts:7`
**Issue:** SessionId error message uses different format: `"Invalid session ID: must be non-empty"` vs others like `"Invalid Telegram ID: ${value}"`.
**Impact:** Minor inconsistency in error messages.
**Suggestion:** Standardize error message format across all branded types.

#### [N3] TOKEN_MINTS construction at module load time
**Location:** `src/infrastructure/shared/config/tokens.ts:38-52`
**Issue:** `new TokenMint(...)` calls happen at module initialization. If validation fails (impossible with hardcoded valid values, but pattern concern), error would occur at startup with unclear stack trace.
**Impact:** None with current hardcoded values, but pattern could cause issues if values come from config.
**Suggestion:** Consider lazy initialization or explicit factory for token config.

## Action Items

- [ ] [C1] Fix TelegramId equality comparison in AuthorizationHelper (use `.value` comparison)
- [ ] [S1] Update SecretStoreRepository interface to use TelegramId branded type
- [ ] [S2] Migrate RequestId to GatewayContext and CommandExecutionContext
- [ ] [S3] Either implement SessionId usage in HTTP transport or document as placeholder
- [ ] [S4] Update conventions.md to document class-based branded type decision
- [ ] [N1] Consider adding `equals()` method to branded types for safe comparison
