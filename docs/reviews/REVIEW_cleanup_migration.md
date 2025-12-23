# Code Review: Task 09 — Cleanup Migration

**Reviewed:** Task 09 — финализация миграции, удаление deprecated services layer
**Date:** 2025-12-23
**Status:** 🟡 Approved with comments

---

## Summary

Миграция выполнена: deprecated re-exports удалены, папки удалены, сборка проходит. Архитектурные нарушения C1 и C3 исправлены. C2 (зависимость от _wip) отложена — будет исправлена при рефакторинге DCA scheduling.

---

## Findings

### 🔴 Critical (must fix before merge)

#### [C1] Domain layer импортирует из data layer ✅ FIXED

**Location:**
- `src/domain/usecases/CreateWalletUseCase.ts`
- `src/domain/usecases/ExportWalletKeyUseCase.ts`

**Fix:**
1. Создан интерфейс `SecretStoreRepository` в `domain/repositories/`
2. `SecretCache` реализует интерфейс
3. Use cases принимают интерфейс через конструктор

---

#### [C2] Domain layer импортирует из _wip ⏸️ DEFERRED

**Location:**
- `src/domain/usecases/GetDcaStatusUseCase.ts:6`
- `src/domain/usecases/StartDcaUseCase.ts:6`
- `src/domain/usecases/StopDcaUseCase.ts:6`

**Status:** Отложено. _wip модуль будет рефакторен отдельно.

---

#### [C3] Domain импортирует из infrastructure/internal ✅ FIXED

**Location:**
- `src/domain/repositories/BlockchainRepository.ts`
- `src/domain/usecases/ExportWalletKeyUseCase.ts`
- `src/domain/usecases/ExecuteSwapUseCase.ts`

**Fix:** `KeyEncryptionService` перемещён в `infrastructure/shared/crypto/`. Все импорты обновлены.

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1-N3] Комментарии ссылаются на SolanaService ✅ FIXED

**Locations:**
- `src/data/repositories/memory/CachedBalanceRepository.ts:4`
- `src/data/repositories/memory/InMemoryUserRepository.ts:6`
- `src/data/repositories/sqlite/SQLiteUserRepository.ts:6`

**Fix:** Комментарии обновлены: `SolanaService` → `SolanaRpcClient`

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Deprecated файлы удалены, сборка проходит |
| Architecture | ⚠️ | C1, C3 исправлены. C2 (_wip) отложен |
| Security | ✅ | Нет проблем |
| Code Quality | ✅ | Типы явные, нет `any` |
| Conventions | ✅ | Комментарии обновлены |

---

## Acceptance Criteria Status

- [x] Все импорты обновлены на новые пути
- [x] Удалены все deprecated re-exports
- [x] Папка `src/services/` удалена
- [x] Папка `src/data/datasources/` удалена
- [x] Папка `src/config/` удалена
- [x] `npm run build` проходит без ошибок
- [x] [C1] Создан интерфейс `SecretStoreRepository` в domain layer
- [x] [C3] `KeyEncryptionService` перемещён в `infrastructure/shared/crypto/`
- [x] [N1-N3] Комментарии обновлены SolanaService → SolanaRpcClient

---

## Action Items

- [x] [C1] Создать интерфейс `SecretStoreRepository` в domain layer
- [ ] [C2] Создать интерфейс `DcaSchedulerPort` в domain layer (отложено)
- [x] [C3] Переместить `KeyEncryptionService` в `infrastructure/shared/crypto/`
- [x] [N1-N3] Обновить комментарии SolanaService → SolanaRpcClient

---

## Verdict

**Задача Task 09 одобрена с комментариями.** Основные архитектурные нарушения (C1, C3) исправлены. C2 (зависимость от _wip) отложена и будет исправлена при рефакторинге DCA scheduling модуля.

**Рекомендация:** Можно мержить. C2 трекать как отдельную задачу.
