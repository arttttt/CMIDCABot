# Code Review: Telegram Error Classification (v2 - после исправлений)

**Reviewed:**
- `src/infrastructure/shared/resilience/TelegramErrors.ts`
- `src/infrastructure/shared/resilience/index.ts`
- `src/presentation/telegram/TelegramAdapter.ts`
- `src/presentation/telegram/ErrorMessages.ts`

**Date:** 2025-12-24
**Status:** 🟡 Approved with comments

---

## Summary

Предыдущие замечания [S1, S2, N1, N3] исправлены. Однако при добавлении description в логи (N3) появилось новое архитектурное нарушение: знание о структуре GrammyError (`description` property) "вытекло" в адаптер. Также ErrorMessages.ts использует функции вместо класса со static методами.

---

## Findings

### 🔴 Critical (must fix before merge)

Нет критических замечаний.

---

### 🟡 Should Fix (important but not blocking)

#### [S1] Знание о структуре GrammyError в адаптере

**Location:** `src/presentation/telegram/TelegramAdapter.ts:322-323`
```typescript
const description = (error as { description?: string }).description;
```
**Issue:** Адаптер напрямую обращается к `description` — свойству GrammyError. Это имплицитное знание о структуре ошибки grammy, которое должно быть инкапсулировано в классификаторе.
**Impact:** Нарушает принцип "thin adapters" — адаптер должен только маппить, не зная деталей реализации. Если структура GrammyError изменится, придётся менять адаптер.
**Suggestion:** Добавить метод в `TelegramErrorClassifier`:
```typescript
static getDescription(error: unknown): string | undefined {
  if (isGrammyErrorLike(error)) {
    return (error as { description?: string }).description;
  }
  return undefined;
}
```
Адаптер будет использовать: `TelegramErrorClassifier.getDescription(error)`

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] ErrorMessages.ts использует функции вместо класса

**Location:** `src/presentation/telegram/ErrorMessages.ts:23-33`
**Observation:** По конвенциям проекта (CLAUDE.md): "Utility functions: prefer class with static methods over top-level exports".
**Suggestion:** Переделать в класс:
```typescript
export class TelegramErrorMessages {
  static readonly MESSAGES: Record<TelegramErrorType, string> = { ... };

  static getMessage(errorType: TelegramErrorType): string { ... }

  static shouldNotifyUser(errorType: TelegramErrorType): boolean { ... }
}
```

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Все acceptance criteria выполнены |
| Architecture | ⚠️ | Знание о GrammyError.description в адаптере [S1] |
| Security | ✅ | Технические детали скрыты от пользователя |
| Code Quality | ✅ | Типы явные, single responsibility |
| Conventions | ⚠️ | Функции вместо класса в ErrorMessages [N1] |

---

## Resolved from Previous Review

| Finding | Status |
|---------|--------|
| [S1] isHttpErrorLike слишком широкая | ✅ Исправлено — проверка через `error.name` |
| [S2] TELEGRAM_ERROR_MESSAGES в infrastructure | ✅ Исправлено — перенесено в presentation |
| [N1] Дублирование rate limit логики | ✅ Исправлено — используется `isRateLimitError` |
| [N3] description в логах | ✅ Добавлено, но с нарушением [S1] |

---

## Action Items

- [ ] [S1] Переместить извлечение `description` в `TelegramErrorClassifier`
- [ ] [N1] Опционально: переделать ErrorMessages.ts на класс со static методами

---

## Verdict

**🟡 Approved with comments** — функционально готово, рекомендуется исправить [S1] для чистоты архитектуры.
