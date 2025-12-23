# Task: Устранение дублирования логики расчёта аллокаций

## Context

Логика расчёта аллокаций дублируется в трёх местах с разной точностью (Decimal vs number). Это нарушает DRY и создаёт риск расхождений в расчётах. Нужно сделать `AllocationCalculator` единственным источником истины.

## Acceptance Criteria

- [ ] `GetPortfolioStatusUseCase` использует `AllocationCalculator` вместо собственных расчётов
- [ ] `ExecutePurchaseUseCase.selectAssetToBuyWithInfo()` использует `AllocationCalculator` вместо собственных расчётов
- [ ] Тип `AssetSelection` удалён, вместо него используется `AllocationInfo`
- [ ] Поле `asset` переименовано в `symbol` во всех затронутых местах
- [ ] Все расчёты аллокаций используют Decimal-точность через `AllocationCalculator`
- [ ] Код компилируется без ошибок
- [ ] Бот работает корректно (ручная проверка команд `/portfolio` и `/buy`)

## Scope

- Рефакторинг `GetPortfolioStatusUseCase` — использовать `AllocationCalculator`
- Рефакторинг `ExecutePurchaseUseCase.selectAssetToBuyWithInfo()` — использовать `AllocationCalculator`
- Удаление типа `AssetSelection`
- Переименование `asset` → `symbol` в затронутых местах

## Out of Scope

- Unit-тесты
- Изменение логики расчётов (только консолидация)
- Рефакторинг других частей use cases

## Technical Notes

- `AllocationCalculator` уже имеет методы `calculateAllocations()` и `calculatePortfolioStatus()` — они покрывают нужды обоих use cases
- Use cases находятся в том же domain layer — зависимость допустима
- Входные типы: `AssetBalances` (btcBalance, ethBalance, solBalance) и `AssetPrices` (BTC, ETH, SOL)

### Файлы для изменения

| Файл | Действие |
|------|----------|
| `src/domain/usecases/GetPortfolioStatusUseCase.ts:57-84` | Заменить расчёт на вызов `AllocationCalculator.calculatePortfolioStatus()` |
| `src/domain/usecases/ExecutePurchaseUseCase.ts:198-264` | Заменить расчёт на вызов `AllocationCalculator`, адаптировать возврат |
| `src/domain/usecases/ExecutePurchaseUseCase.ts` | Удалить тип `AssetSelection`, использовать `AllocationInfo` |
| Все места с `asset` в контексте выбора | Переименовать в `symbol` |

## Open Questions

Нет — все вопросы закрыты.
