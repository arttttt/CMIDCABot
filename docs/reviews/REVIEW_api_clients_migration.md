# Code Review: API Clients Migration (Task 04)

**Reviewed:**
- `src/data/sources/api/SolanaRpcClient.ts`
- `src/data/sources/api/JupiterPriceClient.ts`
- `src/data/sources/api/JupiterSwapClient.ts`
- `src/data/sources/api/JupiterQuoteClient.ts`
- `src/data/sources/api/BatchRpcClient.ts`
- `src/data/sources/api/index.ts`
- `src/infrastructure/shared/resilience/Retry.ts`
- `src/infrastructure/shared/math/Precision.ts`
- `src/services/*.ts` (re-exports)

**Date:** 2025-12-23
**Status:** 🟡 Approved with comments

---

## Summary

Миграция API клиентов выполнена корректно. Файлы перемещены в правильную директорию, классы переименованы согласно convention, re-exports созданы для обратной совместимости. Есть несколько замечаний по архитектуре и согласованности, которые стоит исправить.

---

## Findings

### 🟡 Should Fix (important but not blocking)

#### [S1] JupiterQuoteClient существенно отличается от оригинала

**Location:** `src/data/sources/api/JupiterQuoteClient.ts:1-43`
**Issue:** Класс `JupiterQuoteClient` выглядит как упрощённая заглушка, а не полноценная миграция `JupiterService`. В оригинальном `jupiter.ts` (который теперь re-export) класс назывался `JupiterService` и имел аналогичную простую структуру. Однако:
1. Используется другой API endpoint (`quote-api.jup.ag/v6` vs `api.jup.ag/swap/v1`)
2. Отсутствует API key в заголовках
3. Нет логирования через `logger`
4. Нет error sanitization

**Suggestion:** Привести `JupiterQuoteClient` к тому же стандарту качества, что и другие клиенты — добавить логирование, API key, sanitization ошибок.

---

#### [S2] Дублирование QuoteParams в index.ts

**Location:** `src/data/sources/api/index.ts:28-35`
**Issue:** `QuoteParams` экспортируется из `JupiterSwapClient.js`, а затем `JupiterQuoteParams` — алиас для `QuoteParams` из `JupiterQuoteClient.js`. Это два разных типа с одинаковым назначением, что может вызвать путаницу.

**Suggestion:** Рассмотреть унификацию типов или более явное именование для различения.

---

#### [S3] Комментарий в JupiterPriceClient ссылается на устаревшее имя

**Location:** `src/data/sources/api/JupiterPriceClient.ts:32`
**Issue:** Комментарий `SolanaService.getBalance()` ссылается на старое имя класса.

**Suggestion:** Обновить на `SolanaRpcClient.getBalance()`.

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] Отсутствует trailing comma в некоторых местах

**Location:** `src/data/sources/api/JupiterQuoteClient.ts:41`
**Issue:** `return response.json() as Promise<Quote>;` — в файле нет trailing commas в объектах/массивах, хотя это convention проекта.

**Suggestion:** Добавить trailing commas для согласованности с остальным кодом.

---

#### [N2] JupiterPriceClient.getPrices() не использует retry

**Location:** `src/data/sources/api/JupiterPriceClient.ts:98-102`
**Issue:** В отличие от `SolanaRpcClient`, этот клиент не использует `withRetry` для HTTP запросов. Это может приводить к сбоям при временных проблемах с сетью.

**Observation:** Это не новая проблема — она была в оригинальном коде. Но стоит отметить как потенциальное улучшение.

---

#### [N3] Утилитные функции как top-level exports вместо статических методов класса

**Location:** `src/infrastructure/shared/resilience/Retry.ts`, `src/infrastructure/shared/math/Precision.ts`
**Observation:** Согласно CLAUDE.md, предпочтительны классы со статическими методами для утилит ("Utility functions: prefer class with static methods over top-level exports"). Текущая реализация использует top-level функции.

**Suggestion:** Это можно оставить как есть (функции работают корректно), но для согласованности с convention можно рефакторнуть в классы `RetryUtils` и `PrecisionUtils`.

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Логика сохранена, build проходит |
| Architecture | ✅ | API клиенты в правильном слое `data/sources/api/` |
| Security | ✅ | Sanitization ошибок сохранена |
| Code Quality | ⚠️ | JupiterQuoteClient отличается по качеству от других клиентов |
| Conventions | ⚠️ | Устаревший комментарий, top-level functions vs static methods |

---

## Acceptance Criteria Check

| Criterion | Status |
|-----------|--------|
| `SolanaService` → `SolanaRpcClient` | ✅ |
| `PriceService` → `JupiterPriceClient` | ✅ |
| `JupiterSwapService` → `JupiterSwapClient` | ✅ |
| `JupiterService` → `JupiterQuoteClient` | ✅ |
| `BatchRpcClient` → `BatchRpcClient` | ✅ |
| Re-exports в `src/services/` | ✅ |
| Все импорты работают без изменений | ✅ |
| `npm run build` проходит | ✅ |

---

## Action Items

- [ ] [S1] Улучшить `JupiterQuoteClient` — добавить logging, API key, error sanitization
- [ ] [S2] Рассмотреть унификацию типов `QuoteParams`
- [ ] [S3] Обновить комментарий `SolanaService` → `SolanaRpcClient` в JupiterPriceClient.ts:32
- [ ] [N1] Опционально: добавить trailing commas в JupiterQuoteClient
- [ ] [N2] Опционально: добавить `withRetry` в JupiterPriceClient.getPrices()
- [ ] [N3] Опционально: рефакторинг утилит в классы со статическими методами
