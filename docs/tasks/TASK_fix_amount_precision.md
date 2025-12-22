# Task: Исправление потери точности при конвертации сумм

## Context
При работе с криптовалютными суммами происходит конвертация между человекочитаемыми значениями (например, 1.5 SOL) и минимальными единицами блокчейна (lamports, raw units). Текущая реализация использует `Number` и `Math.pow()`, что приводит к потере точности при очень больших суммах из-за ограничений IEEE 754 float64 (максимальная безопасная точность ~15-17 значащих цифр).

**Пример проблемы:**
- 999,999,999.123456789 SOL в lamports = 999999999123456789
- `Number(999999999123456789)` → `999999999123456800` (потеря последних цифр)

## Acceptance Criteria
- [ ] Конвертация lamports ↔ SOL использует целочисленную арифметику (BigInt)
- [ ] Конвертация raw units ↔ token amount для USDC, BTC, ETH использует BigInt
- [ ] При формировании swap-запросов суммы передаются без потери точности
- [ ] Балансы кошельков отображаются корректно для любых сумм
- [ ] Существующие тесты проходят
- [ ] Добавлены unit-тесты для граничных случаев (очень большие суммы)

## Scope
**Включено:**
- Рефакторинг конвертации в `src/services/jupiter-swap.ts` (строки 194-196, 318, 336)
- Рефакторинг конвертации в `src/services/solana.ts` (строки 163, 219, 316, 365)
- Создание utility-функций для безопасной конвертации
- Unit-тесты для новых функций

## Out of Scope
- Форматирование для отображения (toFixed остаётся, это только презентация)
- Изменение API контрактов
- Миграция данных
- Другие сервисы, не связанные с конвертацией сумм

## Technical Notes

### Текущие проблемные паттерны:
```typescript
// ПРОБЛЕМА: потеря точности для больших чисел
const amount = Number(data.inAmount) / Math.pow(10, decimals);
const lamports = Math.floor(amountSol * Math.pow(10, 9));
```

### Рекомендуемый подход:
```typescript
// BigInt для внутренних операций
const lamports = BigInt(data.inAmount);
const divisor = 10n ** BigInt(decimals);

// Конвертация в human-readable только для отображения
function toHumanReadable(raw: bigint, decimals: number): string {
  // Использовать строковую математику для точности
}
```

### Затронутые файлы:
1. `src/services/jupiter-swap.ts:194-196` — парсинг quote response
2. `src/services/jupiter-swap.ts:318,336` — формирование swap request
3. `src/services/solana.ts:163` — getBalance (SOL)
4. `src/services/solana.ts:219,365` — getTokenBalance fallback
5. `src/services/solana.ts:316` — batch RPC balance

### Существующая константа:
```typescript
// src/services/solana.ts:32
const LAMPORTS_PER_SOL = 1_000_000_000n; // Уже BigInt!
```

## Open Questions
- Нужно ли создавать отдельный модуль `src/utils/precision.ts` или добавить функции в существующие сервисы?
