<!-- GitHub Issue: #210 -->

# Code Review: Purchase Confirmation Flow

**Reviewed:**
- `src/data/sources/memory/ConfirmationCache.ts`
- `src/domain/repositories/ConfirmationRepository.ts`
- `src/data/repositories/memory/InMemoryConfirmationRepository.ts`
- `src/presentation/formatters/ConfirmationFormatter.ts`
- `src/presentation/commands/handlers.ts`
- `src/presentation/commands/router.ts`
- `src/presentation/commands/types.ts`
- `src/presentation/protocol/gateway/handlers/TelegramCallbackHandler.ts`
- `src/index.ts`

**Date:** 2026-01-04
**Status:** 🟡 Approved with comments

## Summary

The implementation correctly adds a confirmation flow for `/portfolio buy` and `/swap execute` commands with slippage protection and re-confirmation logic. Architecture compliance is good - proper layer separation with repository interface in domain, implementation in data, and formatter in presentation. There are a few issues with duplicate type definitions and one potential security concern with session ownership validation.

## Findings

### 🔴 Critical (must fix)

No critical issues found.

### 🟡 Should Fix

#### [S1] Duplicate type definitions between domain and data layers
**Location:** `src/data/sources/memory/ConfirmationCache.ts:30-44` and `src/domain/repositories/ConfirmationRepository.ts:19-33`
**Issue:** `ConfirmationType` and `ConfirmationSession` are defined in both files with identical structure. The cache (data layer) should import types from the repository interface (domain layer), not redefine them.
**Impact:** Maintenance burden - changes must be made in two places. Risk of types drifting out of sync.
**Suggestion:** Remove type definitions from `ConfirmationCache.ts` and import from `ConfirmationRepository.ts`:
```typescript
import type { ConfirmationType, ConfirmationSession } from "../../../domain/repositories/ConfirmationRepository.js";
```

#### [S2] Cache exports types that should come from domain
**Location:** `src/data/sources/memory/index.ts:20-23`
**Issue:** The memory sources barrel exports `ConfirmationType` and `ConfirmationSession` from `ConfirmationCache.ts`. These are domain types and should only be exported from `src/domain/repositories/ConfirmationRepository.ts`.
**Impact:** Consumers might import types from wrong layer, creating incorrect dependencies.
**Suggestion:** Remove type exports from `src/data/sources/memory/index.ts` and ensure consumers import from domain repository interface.

#### [S3] Portfolio buy always gets SOL quote for preview regardless of auto-selection
**Location:** `src/presentation/commands/handlers.ts:440`
**Issue:** The code always requests a quote for SOL (`getQuoteUsdcToAsset(amount, "SOL")`) in the preview, but `ExecutePurchaseUseCase` auto-selects the asset based on portfolio deviation. The preview shows SOL price while actual purchase might buy BTC or ETH.
**Impact:** Misleading UX - user sees SOL quote but might get different asset and rate on execution.
**Suggestion:** Either:
1. Add a method to determine which asset will be purchased before getting quote, or
2. Show a generic preview without specific asset rate, explaining auto-selection, or
3. Accept asset parameter in `/portfolio buy` command

#### [S4] Business logic in formatter (slippage calculation)
**Location:** `src/presentation/formatters/ConfirmationFormatter.ts:19-23, 183-187`
**Issue:** `calculateSlippageBps` and `isSlippageExceeded` contain business logic for slippage calculation. Per ARCHITECTURE.md: "Business logic in adapters/formatters" is prohibited.
**Impact:** Architecture violation - formatters should only transform data for display.
**Suggestion:** Move slippage calculation logic to domain layer. Create a helper or utility in domain that can be used by use cases and referenced by presentation layer.

### 🟢 Consider

#### [N1] Unused parameters in formatPreview
**Location:** `src/presentation/formatters/ConfirmationFormatter.ts:57-58`
**Issue:** Parameters `_amount` and `_asset` are prefixed with underscore (unused) but passed to the method. The values come from `quote` object anyway.
**Impact:** Minor API clarity issue.
**Suggestion:** Remove unused parameters or document why they might be needed in future.

#### [N2] No automatic cleanup interval for confirmation cache
**Location:** `src/index.ts:176`
**Issue:** Confirmation cache cleanup interval is 30 seconds. Given TTL is 60 seconds, this is reasonable, but consider if more aggressive cleanup is needed for high-traffic scenarios.
**Impact:** Minor memory usage in edge cases.
**Suggestion:** Current implementation is acceptable. Document the cleanup strategy choice.

#### [N3] Synchronous execution in callback handlers loses streaming capability
**Location:** `src/presentation/commands/handlers.ts:381-388, 707-714`
**Issue:** Callback handlers execute purchase/swap synchronously by collecting all generator steps, losing progress streaming. Comment at line 315-316 explains this limitation.
**Impact:** User doesn't see progress updates when confirming, only final result.
**Suggestion:** Consider future enhancement to support streaming in callbacks. Current behavior is acceptable for MVP.

#### [N4] Magic string "AUTO" for asset
**Location:** `src/presentation/commands/handlers.ts:444, 504`
**Issue:** The string "AUTO" is used as a placeholder for auto-selected asset. This is then displayed in preview and stored in session.
**Impact:** Minor - could confuse debugging.
**Suggestion:** Consider using a constant or enum value for clarity.

## Action Items
- [ ] [S1] Remove duplicate types from ConfirmationCache, import from domain
- [ ] [S2] Update memory sources barrel to not export domain types
- [ ] [S3] Address portfolio buy preview showing wrong asset/rate
- [ ] [S4] Move slippage calculation to domain layer
