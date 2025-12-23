# Code Review: WIP Components Refactor (Task 08)

**Reviewed:**
- `src/_wip/dca-scheduling/DcaScheduler.ts`
- `src/_wip/dca-scheduling/index.ts`
- `src/infrastructure/shared/scheduling/CleanupScheduler.ts`
- `src/infrastructure/shared/scheduling/index.ts`
- `src/infrastructure/shared/http/HttpServer.ts`
- `src/infrastructure/shared/http/index.ts`
- `src/presentation/telegram/MessageSender.ts`
- `src/presentation/telegram/UserResolver.ts`
- `src/presentation/telegram/index.ts`
- `src/services/DcaScheduler.ts` (re-export)
- `src/services/SecretCleanupScheduler.ts` (re-export)
- `src/services/HttpServer.ts` (re-export)
- `src/services/MessageSender.ts` (re-export)
- `src/services/userResolver.ts` (re-export)
- `src/services/index.ts`

**Date:** 2025-12-23
**Status:** 🟡 Approved with comments

---

## Summary

Рефакторинг выполнен корректно. Компоненты перемещены согласно спецификации, re-exports с `@deprecated` обеспечивают обратную совместимость. Сборка проходит. Есть несколько архитектурных замечаний для рассмотрения.

---

## Findings

### 🔴 Critical (must fix before merge)

*Нет критических проблем*

---

### 🟡 Should Fix (important but not blocking)

#### [S1] HttpServer импортирует из types/config.ts

**Location:** `src/infrastructure/shared/http/HttpServer.ts:11`
**Issue:** Infrastructure layer импортирует `HttpConfig` из `../../../types/config.js`. Согласно ARCHITECTURE.md: `infrastructure → (nothing, except shared between own modules)`.
**Impact:** Нарушение layer isolation. Infrastructure становится зависим от верхнеуровневых типов.
**Suggestion:**
Вариант 1: Переместить `HttpConfig` в `infrastructure/shared/config/`
Вариант 2: Определить локальный интерфейс `HttpServerConfig` в самом HttpServer.ts
Вариант 3: Принять как допустимое исключение (types/ — это shared types без зависимостей)

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] TelegramMessageSender использует legacy путь к logger

**Location:** `src/presentation/telegram/TelegramMessageSender.ts:12`
**Observation:** Импорт `logger` из `../../services/logger.js` — работает через re-export, но не соответствует новому паттерну.
**Suggestion:** Обновить на прямой импорт:
```typescript
// Было
import { logger } from "../../services/logger.js";

// Рекомендуется
import { logger } from "../../infrastructure/shared/logging/index.js";
```

#### [N2] UserResolver содержит standalone функции

**Location:** `src/presentation/telegram/UserResolver.ts:32-57`
**Observation:** Функции `isUsername`, `parseNumericId`, `normalizeUsername` — top-level exports. По конвенции проекта, utility функции должны быть в классе со static методами.
**Suggestion:** Рассмотреть создание `UserIdentifierParser` class:
```typescript
export class UserIdentifierParser {
  static isUsername(identifier: string): boolean { ... }
  static parseNumericId(identifier: string): number | undefined { ... }
  static normalizeUsername(username: string): string { ... }
}
```
*Примечание:* Это существующий код, не введённый этим рефакторингом. Можно оставить как есть для backward compatibility.

#### [N3] Отсутствует trailing comma в некоторых местах

**Location:** `src/infrastructure/shared/scheduling/CleanupScheduler.ts:21`
**Observation:** Параметр `intervalMs` без trailing comma.
**Suggestion:** Добавить для consistency:
```typescript
constructor(
  private readonly stores: CleanableStore[],
  private readonly intervalMs: number = DEFAULT_CLEANUP_INTERVAL_MS,
) {}
```

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Логика сохранена, re-exports работают |
| Architecture | ⚠️ | HttpServer импортирует из types/ (minor) |
| Security | ✅ | Нет изменений в security-sensitive коде |
| Code Quality | ✅ | Типы явные, no any, SRP соблюдён |
| Conventions | ⚠️ | Legacy logger path, missing trailing comma |

---

## Action Items

- [ ] [S1] Решить вопрос с импортом HttpConfig в infrastructure layer
- [ ] [N1] Обновить импорт logger в TelegramMessageSender (optional)
- [ ] [N3] Добавить trailing comma в CleanupScheduler (optional)

---

## Acceptance Criteria Verification

| Критерий | Статус |
|----------|--------|
| DcaScheduler перемещён в `src/_wip/dca-scheduling/` | ✅ |
| SecretCleanupScheduler → CleanupScheduler в `infrastructure/shared/scheduling/` | ✅ |
| HttpServer размещён в `infrastructure/shared/http/` | ✅ |
| MessageSender размещён в `presentation/telegram/` | ✅ |
| UserResolver размещён в `presentation/telegram/` | ✅ |
| Созданы re-exports для обратной совместимости | ✅ |
| `npm run build` проходит без ошибок | ✅ |
