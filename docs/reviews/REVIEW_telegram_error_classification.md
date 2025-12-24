# Code Review: Telegram Error Classification

**Reviewed:**
- `src/infrastructure/shared/resilience/TelegramErrors.ts`
- `src/infrastructure/shared/resilience/index.ts`
- `src/presentation/telegram/TelegramAdapter.ts` (bot.catch changes)

**Date:** 2025-12-24
**Status:** 🟡 Approved with comments

---

## Summary

Реализация соответствует всем acceptance criteria. Код чистый, без прямых зависимостей от grammy в infrastructure слое (duck typing). Однако есть архитектурное замечание: `TELEGRAM_ERROR_MESSAGES` содержит UI-тексты, но находится в infrastructure вместо presentation. Рекомендуется перенести сообщения в presentation layer.

---

## Findings

### 🔴 Critical (must fix before merge)

Нет критических замечаний.

---

### 🟡 Should Fix (important but not blocking)

#### [S1] isHttpErrorLike проверка слишком широкая

**Location:** `src/infrastructure/shared/resilience/TelegramErrors.ts:75-82`
**Issue:** Функция считает HttpError-like любой объект с property `error`, но без `error_code`. Это может привести к ложным срабатываниям, если другие ошибки имеют свойство `error`.
**Impact:** Некоторые ошибки могут неправильно классифицироваться как Network.
**Suggestion:** Добавить проверку на name или constructor.name:
```typescript
function isHttpErrorLike(error: unknown): error is HttpErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    !("error_code" in error) &&
    // Additional check: HttpError typically extends Error
    error instanceof Error &&
    error.name === "HttpError"
  );
}
```

#### [S2] TELEGRAM_ERROR_MESSAGES нарушает разделение слоёв

**Location:** `src/infrastructure/shared/resilience/TelegramErrors.ts:21-28`
**Issue:** `TELEGRAM_ERROR_MESSAGES` содержит user-facing текстовые сообщения, что является ответственностью presentation layer. Однако константа находится в infrastructure/shared.
**Impact:** Нарушение Clean Architecture — UI-тексты смешаны с инфраструктурной логикой. Усложняет локализацию и изменение сообщений.
**Suggestion:** Разделить классификатор и сообщения:
1. `TelegramErrorClassifier` остаётся в `infrastructure/shared/resilience/` — только классификация, возвращает `TelegramErrorType`
2. `TELEGRAM_ERROR_MESSAGES` переносится в `presentation/telegram/ErrorMessages.ts` — маппинг типа на user-friendly сообщение
3. `TelegramAdapter` импортирует сообщения из presentation и использует классификатор из infrastructure

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] Дублирование логики rate limit с Retry.ts

**Location:** `src/infrastructure/shared/resilience/TelegramErrors.ts:147`
**Observation:** `classifyByMessage` проверяет "429" и "too many requests", аналогично `isRateLimitError` в `Retry.ts`.
**Suggestion:** Можно переиспользовать `isRateLimitError` для консистентности:
```typescript
import { isRateLimitError } from "./Retry.js";
// ...
if (isRateLimitError(error)) {
  return TelegramErrorType.RateLimit;
}
```

#### [N2] Неиспользуемая константа ERROR_MESSAGE_COMMAND_FAILED удалена

**Location:** `src/presentation/telegram/TelegramAdapter.ts`
**Observation:** Константа была удалена, что правильно — теперь сообщения приходят из TelegramErrorClassifier.
**Suggestion:** Нет действий — просто отмечаю как положительный момент.

#### [N3] Можно добавить description в логи для GrammyError

**Location:** `src/presentation/telegram/TelegramAdapter.ts:321-324`
**Observation:** Логируется только `errorMessage`, но GrammyError также имеет `description` с деталями от Telegram API.
**Suggestion:** Для отладки можно добавить:
```typescript
logger.error("TelegramBot", "Bot error", {
  error: errorMessage,
  errorType,
  // Optionally log description if available (for debugging)
  description: (error as { description?: string }).description,
});
```

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Все acceptance criteria выполнены |
| Architecture | ⚠️ | Duck typing ✅, но UI-сообщения в infrastructure [S2] |
| Security | ✅ | Технические детали скрыты от пользователя |
| Code Quality | ✅ | Явные типы, static methods, single responsibility |
| Conventions | ✅ | Trailing commas, комментарии на английском |

---

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| Ошибки классифицируются по типам | ✅ `TelegramErrorType` enum |
| Network: "Connection issues..." | ✅ Строка 22 |
| Rate limit: "Too many requests..." | ✅ Строка 23 |
| Server error: "Service temporarily unavailable..." | ✅ Строка 24 |
| Bad request / Unknown: generic message | ✅ Строки 26-27 |
| 403 Forbidden — сообщение НЕ отправляется | ✅ `shouldNotifyUser()` + строка 327 |
| Работает с polling и webhook | ✅ `bot.catch` универсален |
| Уровень логирования `error` | ✅ Строка 321 |

---

## Action Items

- [ ] [S2] Перенести `TELEGRAM_ERROR_MESSAGES` в `presentation/telegram/ErrorMessages.ts`
- [ ] [S1] Рассмотреть усиление проверки `isHttpErrorLike` (опционально)
- [ ] [N1] Опционально: переиспользовать `isRateLimitError` (minor refactor)
- [ ] [N3] Опционально: добавить `description` в логи для отладки

---

## Verdict

**🟡 Approved with comments** — код функционально готов, но рекомендуется адресовать [S2] (перенос UI-сообщений в presentation) для соблюдения Clean Architecture.
