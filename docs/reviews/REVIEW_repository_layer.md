# Code Review: Task 06 - Repository Layer (Dependency Inversion)

**Reviewed:**
- `src/domain/repositories/BlockchainRepository.ts`
- `src/domain/repositories/PriceRepository.ts`
- `src/domain/repositories/SwapRepository.ts`
- `src/data/repositories/SolanaBlockchainRepository.ts`
- `src/data/repositories/JupiterPriceRepository.ts`
- `src/data/repositories/JupiterSwapRepository.ts`
- `src/domain/usecases/ExecutePurchaseUseCase.ts`
- `src/domain/usecases/ExecuteSwapUseCase.ts`
- `src/domain/usecases/GetQuoteUseCase.ts`
- `src/domain/usecases/GetPricesUseCase.ts`
- `src/domain/usecases/GetBalanceUseCase.ts`
- `src/domain/usecases/helpers/WalletInfoHelper.ts`
- `src/domain/repositories/index.ts`
- `src/data/repositories/index.ts`

**Date:** 2025-12-23
**Status:** 🟡 Approved with comments

---

## Summary

Реализация Task 06 выполнена корректно: созданы интерфейсы репозиториев в domain layer и их реализации в data layer. Use Cases теперь зависят от абстракций. Однако есть нарушение Clean Architecture — domain layer импортирует константы из data layer (TOKEN_MINTS). Также новые репозитории не экспортированы из data/repositories/index.ts.

---

## Findings

### 🔴 Critical (must fix before merge)

*Нет критических проблем*

---

### 🟡 Should Fix (important but not blocking)

#### [S1] Domain layer depends on Data layer (Architecture Violation)

**Location:**
- `src/domain/usecases/ExecuteSwapUseCase.ts:20`
- `src/domain/usecases/GetQuoteUseCase.ts:7`
- `src/domain/usecases/SimulateSwapUseCase.ts:14`

**Issue:** Domain layer импортирует `TOKEN_MINTS` из `../../data/sources/api/JupiterPriceClient.js`. Это нарушает принцип Clean Architecture — зависимости должны указывать только внутрь (data → domain), но не наружу (domain → data).

**Impact:** Нарушение архитектурных границ. При изменении data layer потребуются изменения в domain layer.

**Suggestion:**
Перенести `TOKEN_MINTS` в domain layer или types:

```typescript
// Option 1: src/types/tokens.ts
export const TOKEN_MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  BTC: "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij",
  ETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
} as const;

// Option 2: Сделать getOutputMint методом SwapRepository
interface SwapRepository {
  getOutputMint(asset: AssetSymbol): string;
  // ...
}
```

---

#### [S2] New repositories not exported from data/repositories/index.ts

**Location:** `src/data/repositories/index.ts:1-5`

**Issue:** Файл `data/repositories/index.ts` экспортирует только `./sqlite/index.js`. Новые репозитории (SolanaBlockchainRepository, JupiterPriceRepository, JupiterSwapRepository) не включены в barrel export.

**Impact:** Несогласованность в структуре экспортов. Импорт новых репозиториев требует полного пути вместо barrel import.

**Suggestion:**
```typescript
// src/data/repositories/index.ts
export * from "./sqlite/index.js";
export * from "./SolanaBlockchainRepository.js";
export * from "./JupiterPriceRepository.js";
export * from "./JupiterSwapRepository.js";
```

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] Type import from infrastructure in domain interface

**Location:** `src/domain/repositories/BlockchainRepository.ts:13`

**Observation:** Domain repository interface импортирует `KeyEncryptionService` из infrastructure layer:
```typescript
import type { KeyEncryptionService } from "../../infrastructure/internal/crypto/index.js";
```

**Suggestion:** В идеале domain должен определить собственный интерфейс шифрования, а infrastructure — его реализовать. Однако для type-only import это допустимо и может быть исправлено в отдельной задаче по рефакторингу криптографии.

---

#### [N2] Type casting in JupiterSwapRepository.buildSwapTransaction

**Location:** `src/data/repositories/JupiterSwapRepository.ts:40-45`

**Observation:** Приведение типа с `as ClientSwapQuote` обходит проверку типов:
```typescript
const clientQuote = {
  ...quote,
  rawQuoteResponse: quote.rawQuoteResponse,
} as ClientSwapQuote;
```

**Suggestion:** Можно сохранить оригинальный quote в WeakMap или использовать brand type pattern для type-safe преобразования. Но текущая реализация работает корректно и является приемлемым компромиссом.

---

#### [N3] Optional chaining with non-null assertion

**Location:** `src/domain/usecases/ExecuteSwapUseCase.ts:146,171`

**Observation:** После проверки `if (!this.swapRepository)` используется `this.swapRepository!`:
```typescript
quote = await this.swapRepository!.getQuoteUsdcToToken(amountUsdc, outputMint);
```

**Suggestion:** TypeScript не сужает тип после early return. Альтернатива — сохранить в локальную переменную:
```typescript
const repo = this.swapRepository;
if (!repo) { return; }
// далее использовать repo без !
```

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Логика соответствует acceptance criteria, build проходит |
| Architecture | ⚠️ | S1: domain импортирует из data (TOKEN_MINTS) |
| Security | ✅ | Шифрование ключей сохранено, логи не содержат секретов |
| Code Quality | ✅ | Типы явные, нет any, SRP соблюден |
| Conventions | ✅ | Trailing commas, комменты на English |

---

## Acceptance Criteria Verification

| Criterion | Status | Notes |
|-----------|--------|-------|
| Interfaces in domain/repositories/ | ✅ | BlockchainRepository, PriceRepository, SwapRepository созданы |
| Implementations in data/repositories/ | ✅ | SolanaBlockchainRepository, JupiterPriceRepository, JupiterSwapRepository созданы |
| Use Cases depend on interfaces | ✅ | ExecutePurchaseUseCase, ExecuteSwapUseCase и др. используют интерфейсы |
| No services/ imports in ExecutePurchaseUseCase | ✅ | Проверено grep — импорты из services/ отсутствуют |
| No services/ imports in ExecuteSwapUseCase | ✅ | Проверено grep — импорты из services/ отсутствуют |
| npm run build passes | ✅ | Билд успешен |

**Примечание:** В domain layer остались импорты из services/ в других use cases (DcaScheduler, DcaService, AuthorizationService, SecretStore) — это выходит за рамки Task 06 и планируется для Stage 7.

---

## Action Items

- [ ] **[S1]** Перенести TOKEN_MINTS из data/sources/api/ в types/ или domain/constants/
- [ ] **[S2]** Добавить экспорт новых репозиториев в data/repositories/index.ts
- [ ] *(Optional)* **[N1]** В будущем создать domain interface для encryption и инвертировать зависимость
