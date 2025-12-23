# Code Review: Refactor Business Logic (Task 07)

**Reviewed:**
- `src/domain/usecases/helpers/AllocationCalculator.ts`
- `src/domain/usecases/helpers/AuthorizationHelper.ts`
- `src/domain/usecases/AddAuthorizedUserUseCase.ts`
- `src/domain/usecases/RemoveAuthorizedUserUseCase.ts`
- `src/domain/usecases/UpdateUserRoleUseCase.ts`
- `src/domain/usecases/GetAllAuthorizedUsersUseCase.ts`
- `src/domain/usecases/InitializeAuthorizationUseCase.ts`
- `src/domain/usecases/ExecuteMockPurchaseUseCase.ts`
- `src/domain/usecases/ResetPortfolioUseCase.ts`
- `src/domain/usecases/ExecuteBatchDcaUseCase.ts`
- `src/domain/usecases/DeleteUserDataUseCase.ts`
- `src/domain/usecases/InitUserUseCase.ts`
- `src/services/DcaScheduler.ts`
- `src/presentation/protocol/ProtocolHandler.ts`
- `src/presentation/commands/handlers.ts`
- `src/index.ts`

**Date:** 2025-12-23
**Status:** 🟢 Approved

---

## Summary

Рефакторинг выполнен корректно. Бизнес-логика из `DcaService` и `AuthorizationService` успешно перенесена в Use Cases. Архитектурные принципы соблюдены — зависимости направлены внутрь, domain layer не зависит от внешних фреймворков. Код чистый, типизированный, следует конвенциям проекта.

---

## Findings

### 🟡 Should Fix (important but not blocking)

#### [S1] DcaScheduler остаётся в services/

**Location:** `src/services/DcaScheduler.ts`
**Issue:** DcaScheduler находится в `services/`, хотя согласно ARCHITECTURE.md папка `_wip/dca-scheduling/` предназначена для этого компонента.
**Suggestion:** Переместить в `src/_wip/dca-scheduling/` согласно архитектурной документации, либо обновить ARCHITECTURE.md если решено оставить в services.

---

#### [S2] Helpers в папке usecases создают неоднозначность

**Location:** `src/domain/usecases/helpers/`
**Issue:** Создана подпапка `helpers` внутри `usecases`. ARCHITECTURE.md запрещает "Utils/helpers/common" как anti-pattern. Однако AllocationCalculator и AuthorizationHelper — это специфические domain helpers, не общие утилиты.
**Suggestion:** Рассмотреть альтернативные варианты:
- Переместить в `src/domain/helpers/` (отдельно от usecases)
- Оставить как есть, но документировать исключение в ARCHITECTURE.md
- AllocationCalculator можно было бы разместить как метод Portfolio entity

---

#### [S3] Тип AdminOperationResult определён в presentation layer

**Location:** `src/presentation/formatters/AdminFormatter.ts:11`
**Issue:** Тип `AdminOperationResult` определён в formatter (presentation), но используется как результат Use Cases. Это нарушает направление зависимостей — presentation не должен определять типы для domain.
**Suggestion:** Перенести тип в domain layer:
```typescript
// src/domain/usecases/types.ts или отдельный файл
export type AdminOperationResult =
  | { success: true; message: string }
  | { success: false; error: string };
```

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] Дублирование проверки owner в AuthorizationHelper

**Location:** `src/domain/usecases/helpers/AuthorizationHelper.ts:33-35`, `49-50`, `57-58`, `67-68`
**Observation:** Проверка `telegramId === this.ownerTelegramId` повторяется в каждом методе.
**Suggestion:** Можно вынести в приватный метод `isOwner(telegramId: number): boolean` для DRY.

---

#### [N2] ExecuteBatchDcaUseCase зависит от другого Use Case

**Location:** `src/domain/usecases/ExecuteBatchDcaUseCase.ts:25`
**Observation:** Use Case принимает другой Use Case (`ExecuteMockPurchaseUseCase`) как зависимость. Это не anti-pattern, но увеличивает связность.
**Suggestion:** Текущая реализация приемлема для dev-only функциональности. В production варианте можно рассмотреть инверсию через интерфейс.

---

#### [N3] Inline import type в index.ts

**Location:** `src/index.ts:187`
**Observation:** Используется inline import type для PortfolioRepository:
```typescript
let portfolioRepository: import("./domain/repositories/PortfolioRepository.js").PortfolioRepository | undefined;
```
**Suggestion:** Можно вынести в обычный import в начале файла для консистентности.

---

#### [N4] ResetPortfolioUseCase не экспортируется в index.ts use cases

**Location:** `src/domain/usecases/index.ts`
**Observation:** ResetPortfolioUseCase создан, но не используется в текущей реализации (нет команды /portfolio reset).
**Suggestion:** Либо добавить команду, либо удалить неиспользуемый use case.

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Логика корректна, edge cases обработаны |
| Architecture | ⚠️ | Helpers в usecases, тип в presentation — minor issues |
| Security | ✅ | Проверки прав корректны, нет secrets в коде |
| Code Quality | ✅ | Типы явные, SRP соблюдён, код читаемый |
| Conventions | ✅ | Trailing commas, English comments, patterns соблюдены |

---

## Action Items

- [ ] [S1] Переместить DcaScheduler в _wip/dca-scheduling/ → **отложено до Task 08**
- [ ] [S2] Переместить helpers из usecases в `src/domain/helpers/`
- [ ] [S3] Перенести AdminOperationResult в domain layer
- [ ] [N4] Удалить ResetPortfolioUseCase (не используется)
