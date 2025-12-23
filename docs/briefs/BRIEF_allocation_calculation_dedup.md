# Brief: Устранение дублирования логики расчёта аллокаций

## Problem Statement

Логика расчёта аллокаций (текущий %, отклонение от цели) дублируется в трёх местах с разной точностью вычислений:

| Место | Тип данных | Риск |
|-------|------------|------|
| `AllocationCalculator.calculateAllocations()` | Decimal | Эталон |
| `GetPortfolioStatusUseCase.execute()` | number | Возможны расхождения |
| `ExecutePurchaseUseCase.selectAssetToBuyWithInfo()` | number | Возможны расхождения |

**Проблемы:**
- Нарушение DRY — изменения нужно вносить в 3 места
- Потенциальные расхождения из-за разной точности (Decimal vs number)
- Риск багов при модификации логики в одном месте, но не в других

## Proposed Solution

Сделать `AllocationCalculator` единственным источником истины для расчёта аллокаций. Use cases должны использовать калькулятор вместо собственных расчётов.

## Technical Context

### Текущая реализация

**1. AllocationCalculator** (`src/domain/helpers/AllocationCalculator.ts:40-78`)
```typescript
// Использует Decimal для промежуточных вычислений
const valueInUsdc = multiplyAmount(asset.balance, prices[asset.symbol]);
totalValueDecimal = totalValueDecimal.plus(valueInUsdc);
// ...
const currentAllocation = divideAmount(v.valueInUsdc, totalValueDecimal).toNumber();
```

**2. GetPortfolioStatusUseCase** (`src/domain/usecases/GetPortfolioStatusUseCase.ts:57-84`)
```typescript
// Использует обычные number операции
valueInUsdc: btcBalance * prices.BTC
// ...
const currentAllocation = asset.valueInUsdc / totalValueInUsdc;
```

**3. ExecutePurchaseUseCase** (`src/domain/usecases/ExecutePurchaseUseCase.ts:198-264`)
```typescript
// Использует обычные number операции
valueInUsdc: balances.btc * prices.BTC
// ...
const currentAllocation = asset.valueInUsdc / totalValueInUsdc;
```

### Зависимости
- `AllocationCalculator` уже существует в domain layer
- Use cases находятся в том же слое — зависимость допустима
- Интерфейс калькулятора может потребовать расширения для удобства use cases

## Suggested Approach

1. **Расширить API AllocationCalculator:**
   - Добавить метод `calculateFromBalances(balances: AssetBalances, prices: AssetPrices)` для удобства use cases

2. **Рефакторинг GetPortfolioStatusUseCase:**
   - Внедрить `AllocationCalculator` через DI
   - Заменить ручной расчёт на вызов калькулятора

3. **Рефакторинг ExecutePurchaseUseCase:**
   - Внедрить `AllocationCalculator` через DI
   - Метод `selectAssetToBuyWithInfo()` использует калькулятор для получения deviation
   - Выбор актива с минимальным deviation остаётся в use case

## Open Questions for PM

- [ ] Нужно ли покрыть рефакторинг unit-тестами?
- [ ] Есть ли требования к обратной совместимости API use cases?
- [ ] Приоритет задачи относительно других?

## References

- `src/domain/helpers/AllocationCalculator.ts` — эталонная реализация
- `src/domain/usecases/GetPortfolioStatusUseCase.ts:57-84` — дубликат #1
- `src/domain/usecases/ExecutePurchaseUseCase.ts:198-264` — дубликат #2
- `src/infrastructure/shared/math/` — математические утилиты (Decimal)
