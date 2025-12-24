# Code Review: CODE-02 — Консолидация конфигурации токенов

**Reviewed:**
- `src/infrastructure/shared/config/tokens.ts` (новый)
- `src/infrastructure/shared/config/index.ts`
- `src/data/sources/api/JupiterPriceClient.ts`
- `src/data/sources/api/JupiterSwapClient.ts`
- `src/data/sources/api/index.ts`
- `src/data/repositories/memory/CachedBalanceRepository.ts`
- `src/data/repositories/JupiterSwapRepository.ts`

**Date:** 2024-12-24
**Status:** 🟢 Approved

---

## Summary

Рефакторинг выполнен корректно. Token mints и decimals консолидированы в единый файл `tokens.ts`, что устраняет дублирование и снижает риск рассинхронизации. Архитектурные правила соблюдены — файл размещён в `infrastructure/shared/config/`, доступном всем слоям.

---

## Findings

### 🔴 Critical (must fix before merge)

Нет критических проблем.

---

### 🟡 Should Fix (important but not blocking)

#### [S1] TokenConfig interface не используется для типизации TOKENS

**Location:** `src/infrastructure/shared/config/tokens.ts:6-9, 34-51`
**Issue:** Объявлен `TokenConfig` interface, но `TOKENS` объект его не использует. Это создаёт несогласованность — interface экспортируется, но не применяется для валидации структуры.
**Suggestion:**
```typescript
// Вариант 1: Явно типизировать TOKENS
export const TOKENS: Record<string, TokenConfig> = {
  SOL: { mint: "...", decimals: 9 },
  // ...
} as const;

// Вариант 2: Удалить interface, если он не нужен
// (оставить только as const для literal types)
```

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] Лишняя пустая строка в JupiterPriceClient

**Location:** `src/data/sources/api/JupiterPriceClient.ts:16`
**Observation:** Двойная пустая строка после import блока.
**Suggestion:** Удалить лишнюю пустую строку для consistency.

#### [N2] Документация TOKEN_MINTS/TOKEN_DECIMALS как "backward-compatible"

**Location:** `src/infrastructure/shared/config/tokens.ts:53-54, 63-64`
**Observation:** Комментарии указывают на backward compatibility, но теперь это основной способ использования. Комментарий может вводить в заблуждение.
**Suggestion:** Переформулировать как "Convenience exports for direct access" или убрать комментарий.

#### [N3] Повторяющийся паттерн в CachedBalanceRepository

**Location:** `src/data/repositories/memory/CachedBalanceRepository.ts:23-27`
**Observation:** `TOKEN_CONFIGS` дублирует структуру `TOKENS`, просто с lowercase ключами.
**Suggestion:** Можно было бы использовать `TOKENS` напрямую и преобразовывать ключи динамически, но текущий вариант более читаем и type-safe. Оставить как есть.

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Логика консолидации корректна, все импорты обновлены |
| Architecture | ✅ | Файл в правильном месте (infrastructure/shared/config), доступен всем слоям |
| Security | ✅ | Только публичные mainnet адреса токенов |
| Code Quality | ⚠️ | Мелкое несоответствие: TokenConfig не используется |
| Conventions | ✅ | Trailing commas, комментарии на английском, as const |

---

## Action Items

- [ ] [S1] Решить судьбу TokenConfig interface — использовать или удалить
- [ ] [N1] Удалить лишнюю пустую строку в JupiterPriceClient (опционально)
