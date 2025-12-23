# Code Review: Task 09 — Cleanup Migration

**Reviewed:** Task 09 — финализация миграции, удаление deprecated services layer
**Date:** 2025-12-23
**Status:** 🟡 Approved with comments

---

## Summary

Миграция выполнена корректно: все deprecated re-exports удалены, папки `src/services/`, `src/config/`, `src/data/datasources/` удалены, импорты обновлены, сборка проходит. Однако обнаружены **архитектурные нарушения** в domain layer, которые существовали до миграции и не были исправлены. Эти нарушения не блокируют merge, но требуют внимания в будущем.

---

## Findings

### 🟡 Should Fix (important but not blocking)

#### [S1] Domain layer импортирует из data layer

**Location:**
- `src/domain/usecases/CreateWalletUseCase.ts:8`
- `src/domain/usecases/ExportWalletKeyUseCase.ts:10`

**Issue:**
```typescript
import { SecretCache } from "../../data/sources/memory/index.js";
```

Domain напрямую зависит от `SecretCache` из `data/sources/memory`. Согласно ARCHITECTURE.md:
```
domain → (nothing, only own interfaces)
```

**Impact:** Нарушение Clean Architecture. Domain layer должен зависеть только от своих интерфейсов, а не от конкретных реализаций из data layer.

**Suggestion:**
1. Создать интерфейс `SecretStoreRepository` в `domain/repositories/`
2. `SecretCache` должен реализовывать этот интерфейс
3. Use cases должны принимать интерфейс через конструктор

---

#### [S2] Domain layer импортирует из _wip

**Location:**
- `src/domain/usecases/GetDcaStatusUseCase.ts:6`
- `src/domain/usecases/StartDcaUseCase.ts:6`
- `src/domain/usecases/StopDcaUseCase.ts:6`

**Issue:**
```typescript
import { DcaScheduler } from "../../_wip/dca-scheduling/index.js";
```

Domain зависит от WIP компонента, который находится вне стандартной архитектуры.

**Impact:** Архитектурное нарушение. WIP компоненты не должны напрямую импортироваться в domain.

**Suggestion:**
Создать интерфейс `DcaSchedulerPort` в `domain/repositories/` (или отдельной директории для ports). DcaScheduler должен реализовывать этот интерфейс.

---

#### [S3] Domain импортирует из infrastructure/internal

**Location:**
- `src/domain/repositories/BlockchainRepository.ts:13`
- `src/domain/usecases/ExportWalletKeyUseCase.ts:13`
- `src/domain/usecases/ExecuteSwapUseCase.ts:22`

**Issue:**
```typescript
import type { KeyEncryptionService } from "../../infrastructure/internal/crypto/index.js";
```

Согласно ARCHITECTURE.md:
```
infrastructure/internal — data only
```

**Impact:** Domain layer не должен иметь доступ к internal infrastructure.

**Suggestion:**
Переместить `KeyEncryptionService` в `infrastructure/shared/crypto/` или создать интерфейс в domain layer.

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] Комментарий в файле ссылается на старое имя класса

**Location:** `src/data/repositories/memory/CachedBalanceRepository.ts:4`

**Observation:**
```typescript
 * In-memory cache over SolanaService RPC calls.
```
Комментарий упоминает `SolanaService`, хотя класс переименован в `SolanaRpcClient`.

**Suggestion:** Обновить комментарий для консистентности.

---

#### [N2] Комментарий в InMemoryUserRepository ссылается на SolanaService

**Location:** `src/data/repositories/memory/InMemoryUserRepository.ts:6`

**Observation:**
```typescript
 * only at the moment of signing (in SolanaService) to minimize exposure.
```

**Suggestion:** Обновить на `SolanaRpcClient`.

---

#### [N3] Аналогичный комментарий в SQLiteUserRepository

**Location:** `src/data/repositories/sqlite/SQLiteUserRepository.ts:6`

**Observation:** Та же проблема — упоминание `SolanaService` вместо `SolanaRpcClient`.

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Все acceptance criteria выполнены |
| Architecture | ⚠️ | Domain импортирует из data/infrastructure/internal (pre-existing) |
| Security | ✅ | Нет проблем |
| Code Quality | ✅ | Типы явные, нет `any` |
| Conventions | ✅ | Trailing commas, English comments |

---

## Acceptance Criteria Status

- [x] Все импорты обновлены на новые пути
- [x] Удалены все deprecated re-exports
- [x] Папка `src/services/` удалена
- [x] Папка `src/data/datasources/` удалена
- [x] Папка `src/config/` удалена
- [x] `npm run build` проходит без ошибок

---

## Action Items

- [ ] [S1] Создать интерфейс `SecretStoreRepository` в domain layer (отдельная задача)
- [ ] [S2] Создать интерфейс `DcaSchedulerPort` при рефакторинге DcaScheduler (связано с _wip)
- [ ] [S3] Решить архитектурный вопрос с `KeyEncryptionService` (отдельная задача)
- [ ] [N1-N3] Обновить комментарии SolanaService → SolanaRpcClient (minor)

---

## Verdict

**Задача Task 09 выполнена корректно.** Все acceptance criteria удовлетворены. Архитектурные нарушения (S1-S3) — это pre-existing issues, которые существовали до миграции. Они не являются результатом этой задачи и должны быть адресованы отдельными задачами.

**Рекомендация:** Merge approved. Создать отдельные задачи для исправления архитектурных нарушений.
