# Code Review: Task 09 — Cleanup Migration

**Reviewed:** Task 09 — финализация миграции, удаление deprecated services layer
**Date:** 2025-12-23
**Status:** 🔴 Needs work

---

## Summary

Миграция выполнена частично: deprecated re-exports удалены, папки удалены, сборка проходит. Однако обнаружены **архитектурные нарушения** в domain layer, которые **должны быть исправлены** перед merge. Domain layer напрямую зависит от data layer и infrastructure/internal, что нарушает Clean Architecture.

---

## Findings

### 🔴 Critical (must fix before merge)

#### [C1] Domain layer импортирует из data layer

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

#### [C2] Domain layer импортирует из _wip

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

#### [C3] Domain импортирует из infrastructure/internal

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
| Correctness | ✅ | Deprecated файлы удалены, сборка проходит |
| Architecture | ❌ | Domain импортирует из data/infrastructure/internal — нарушение Clean Architecture |
| Security | ✅ | Нет проблем |
| Code Quality | ✅ | Типы явные, нет `any` |
| Conventions | ⚠️ | Комментарии ссылаются на старые имена классов |

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

- [ ] [C1] Создать интерфейс `SecretStoreRepository` в domain layer
- [ ] [C2] Создать интерфейс `DcaSchedulerPort` в domain layer
- [ ] [C3] Переместить `KeyEncryptionService` в `infrastructure/shared/crypto/`
- [ ] [N1-N3] Обновить комментарии SolanaService → SolanaRpcClient

---

## Verdict

**Задача Task 09 требует доработки.** Основная работа по удалению deprecated файлов выполнена, но архитектурные нарушения (C1-C3) должны быть исправлены перед merge. Domain layer не должен напрямую зависеть от data layer и infrastructure/internal.

**Рекомендация:** Исправить все critical issues, затем повторное ревью.
