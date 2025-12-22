# Task: Исправление потери точности при конвертации сумм

## Context
При работе с криптовалютными суммами происходит конвертация между человекочитаемыми значениями (например, 1.5 SOL) и минимальными единицами блокчейна (lamports, raw units). Текущая реализация использует `Number` и `Math.pow()`, что приводит к потере точности при очень больших суммах из-за ограничений IEEE 754 float64 (максимальная безопасная точность ~15-17 значащих цифр).

**Пример проблемы:**
- 999,999,999.123456789 SOL в lamports = 999999999123456789
- `Number(999999999123456789)` → `999999999123456800` (потеря последних цифр)

## Acceptance Criteria
- [x] Конвертация lamports ↔ SOL использует точную арифметику (decimal.js)
- [x] Конвертация raw units ↔ token amount для USDC, BTC, ETH использует decimal.js
- [x] При формировании swap-запросов суммы передаются без потери точности
- [x] Балансы кошельков отображаются корректно для любых сумм
- [x] Существующие тесты проходят (тестов в проекте нет)
- [ ] Добавлены unit-тесты для граничных случаев (очень большие суммы)

## Scope
**Включено:**
- Рефакторинг конвертации в `src/services/jupiter-swap.ts`
- Рефакторинг конвертации в `src/services/solana.ts`
- Рефакторинг расчётов в `src/services/dca.ts`
- Создание `src/services/precision.ts` с utility-функциями

## Out of Scope
- Форматирование для отображения (toFixed остаётся, это только презентация)
- Изменение API контрактов
- Миграция данных

## Technical Notes

### Решение: decimal.js
Использована библиотека `decimal.js` для произвольной точности с поддержкой дробных чисел.

### Созданные функции (src/services/precision.ts):
```typescript
// Конвертация human → raw (например, 1.5 SOL → "1500000000")
toRawAmount(humanAmount: Decimal | number | string, decimals: number): string

// Конвертация raw → Decimal (например, "1500000000" → Decimal(1.5))
toHumanAmount(rawAmount: string | bigint, decimals: number): Decimal

// Конвертация raw → number для отображения
toHumanAmountNumber(rawAmount: string | bigint, decimals: number): number

// Безопасное деление/умножение
divideAmount(dividend, divisor): Decimal
multiplyAmount(a, b): Decimal
```

### Изменённые файлы:
1. `src/services/jupiter-swap.ts` — toRawAmount, toHumanAmountNumber
2. `src/services/solana.ts` — toHumanAmountNumber для балансов
3. `src/services/dca.ts` — Decimal для расчётов аллокаций и цен

## Resolution
- Создан модуль `src/services/precision.ts` (не utils, чтобы избежать свалки)
- Добавлена зависимость `decimal.js` (~31KB)
