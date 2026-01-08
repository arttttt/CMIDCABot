<!-- GitHub Issue: #226 -->

# Brief: Remove Test/Simulation Code

## Problem Statement

В проекте остался код для симуляции и mock-покупок с раннего этапа разработки:
- Swap simulation (`/swap simulate`) — тестирование транзакций без выполнения
- Mock purchase system — симуляция покупок без реальных swap-операций
- Mock database — отдельная БД для хранения mock-портфолио

Этот код увеличивает сложность кодовой базы, создает технический долг и смешивает mock-логику с production-кодом.

## Proposed Solution

Удалить весь тестовый/симуляционный код одним рефакторингом:
1. Swap Simulation — полное удаление команды и use case
2. Mock Purchase System — удаление use cases для mock-покупок
3. Mock Database — удаление моделей, репозиториев и инфраструктуры

**Важно:** DCA Scheduler (`src/_wip/dca-scheduling/`) НЕ удалять — оставить как есть для будущего рефакторинга.

## Technical Context

### A. Swap Simulation (для удаления)

| Файл | Строки | Описание |
|------|--------|----------|
| `src/domain/usecases/SimulateSwapUseCase.ts` | 186 | Use case симуляции swap-транзакции |
| `src/presentation/formatters/SimulateFormatter.ts` | 181 | Форматирование результатов симуляции |

**Зависимости в других файлах:**
- `handlers.ts`: `createSwapSimulateCommand` (строки 670-686), `SwapCommandDeps.simulateSwap`
- `src/domain/usecases/index.ts`: экспорт (строка 37)
- `src/presentation/formatters/index.ts`: экспорт (строка 12)
- `src/index.ts`: создание use case (строки 285-290)

**Связанный код в BlockchainRepository:**
- `SimulationResult` interface в `BlockchainRepository.ts` (строки 63-68)
- Метод `simulateTransaction()` в интерфейсе (строка 156)
- Реализация в `SolanaBlockchainRepository.ts` (строки 78-80)
- Реализация в `SolanaRpcClient.ts` (строки 608-650)

### B. Mock Purchase System (для удаления)

| Файл | Строки | Описание |
|------|--------|----------|
| `src/domain/usecases/ExecuteMockPurchaseUseCase.ts` | 115 | Симуляция покупки без реального swap |
| `src/domain/usecases/ExecuteBatchDcaUseCase.ts` | 83 | Batch DCA через mock purchases |

**Зависимости:**
- `ExecuteBatchDcaUseCase` зависит от `ExecuteMockPurchaseUseCase`
- Используется в `DcaScheduler` (оставляем scheduler, но он перестанет компилироваться — см. Open Questions)
- Экспорты в `src/domain/usecases/index.ts` (строки 57-59)
- Создание в `src/index.ts` (строки 221-234)

### C. Mock Database Infrastructure (для удаления)

**Domain Models:**
| Файл | Строки |
|------|--------|
| `src/domain/models/Portfolio.ts` | 24 |
| `src/domain/models/Purchase.ts` | 24 |
| `src/domain/models/SchedulerState.ts` | 9 |

**Repository Interfaces:**
| Файл | Строки |
|------|--------|
| `src/domain/repositories/PortfolioRepository.ts` | 34 |
| `src/domain/repositories/PurchaseRepository.ts` | 23 |
| `src/domain/repositories/SchedulerRepository.ts` | 22 |

**SQLite Implementations:**
| Файл | Строки |
|------|--------|
| `src/data/repositories/sqlite/SQLitePortfolioRepository.ts` | 78 |
| `src/data/repositories/sqlite/SQLitePurchaseRepository.ts` | 62 |
| `src/data/repositories/sqlite/SQLiteSchedulerRepository.ts` | 58 |

**Database Infrastructure:**
- `src/data/types/database.ts`: `MockDatabase`, `PortfolioTable`, `PurchasesTable`, `SchedulerStateTable`
- `src/data/sources/database/KyselyDatabase.ts`: `createMockDatabase()`, `initMockSchema()`, `resetMockDatabaseIfNeeded()`, `dropAllMockTables()`
- `src/data/factories/RepositoryFactory.ts`: `MockRepositories`, `createMockRepositories()`

**Configuration:**
- `src/infrastructure/shared/config/envSchema.ts`: `MOCK_DATABASE_PATH`, `mockPath`
- `.env.example`: `MOCK_DATABASE_PATH`
- `README.md`: документация mock database

### D. DCA Scheduler (НЕ удалять)

Директория `src/_wip/dca-scheduling/` остается без изменений. После удаления mock-зависимостей scheduler перестанет компилироваться — это ожидаемо, т.к. он помечен как WIP и требует отдельного рефакторинга.

## Suggested Approach

### Фаза 1: Удаление Swap Simulation

1. Удалить файлы:
   - `src/domain/usecases/SimulateSwapUseCase.ts`
   - `src/presentation/formatters/SimulateFormatter.ts`

2. Модифицировать `src/presentation/commands/handlers.ts`:
   - Удалить `createSwapSimulateCommand` function
   - Удалить `simulateSwap` из `SwapCommandDeps`
   - Удалить `SimulateSwapUseCase` из imports
   - Удалить `SimulateFormatter` из imports
   - Убрать `["simulate", createSwapSimulateCommand(deps)]` из `createSwapCommand`

3. Обновить `src/presentation/commands/definitions.ts`:
   - Изменить описание swap с "quote/simulate/execute" на "quote/execute"

4. Удалить экспорты:
   - `src/domain/usecases/index.ts`: убрать `SimulateSwapUseCase`
   - `src/presentation/formatters/index.ts`: убрать `SimulateFormatter`

5. Очистить `src/index.ts`:
   - Удалить создание `simulateSwap` use case (строки 285-290)
   - Удалить `simulateSwap` из deps для DevCommandRegistry

6. Удалить из BlockchainRepository:
   - `SimulationResult` interface
   - `simulateTransaction()` method из interface и implementations

### Фаза 2: Удаление Mock Purchase System

1. Удалить файлы:
   - `src/domain/usecases/ExecuteMockPurchaseUseCase.ts`
   - `src/domain/usecases/ExecuteBatchDcaUseCase.ts`

2. Удалить экспорты из `src/domain/usecases/index.ts`:
   - `ExecuteMockPurchaseUseCase`, `MockPurchaseResult`
   - `ExecuteBatchDcaUseCase`, `BatchDcaResult`

3. Очистить `src/index.ts`:
   - Удалить imports для mock use cases
   - Удалить создание `executeMockPurchase` и `executeBatchDca`

### Фаза 3: Удаление Mock Database

1. Удалить domain models:
   - `src/domain/models/Portfolio.ts`
   - `src/domain/models/Purchase.ts`
   - `src/domain/models/SchedulerState.ts`

2. Удалить repository interfaces:
   - `src/domain/repositories/PortfolioRepository.ts`
   - `src/domain/repositories/PurchaseRepository.ts`
   - `src/domain/repositories/SchedulerRepository.ts`

3. Удалить SQLite implementations:
   - `src/data/repositories/sqlite/SQLitePortfolioRepository.ts`
   - `src/data/repositories/sqlite/SQLitePurchaseRepository.ts`
   - `src/data/repositories/sqlite/SQLiteSchedulerRepository.ts`

4. Очистить `src/data/types/database.ts`:
   - Удалить `MockDatabase` interface
   - Удалить `PortfolioTable`, `PurchasesTable`, `SchedulerStateTable`

5. Очистить `src/data/sources/database/KyselyDatabase.ts`:
   - Удалить `createMockDatabase()`
   - Удалить `initMockSchema()`
   - Удалить `resetMockDatabaseIfNeeded()`
   - Удалить `dropAllMockTables()`
   - Удалить `MOCK_SCHEMA_VERSION`

6. Очистить `src/data/factories/RepositoryFactory.ts`:
   - Удалить `MockRepositories` interface
   - Удалить `createMockRepositories()`
   - Удалить imports для mock repositories

7. Очистить `src/data/sources/database/index.ts`:
   - Удалить экспорт `createMockDatabase`

### Фаза 4: Cleanup

1. Обновить `src/infrastructure/shared/config/envSchema.ts`:
   - Удалить `MOCK_DATABASE_PATH`
   - Удалить `mockPath` из database config

2. Обновить `.env.example`:
   - Удалить `MOCK_DATABASE_PATH`

3. Обновить `README.md`:
   - Удалить упоминания mock database

4. Очистить `src/index.ts`:
   - Удалить `mockDb` variable и связанную логику
   - Удалить условную инициализацию mock repositories
   - Упростить `deleteUserData` создание (убрать mock repositories)

## Open Questions for PM

1. **DCA Scheduler после удаления** — после удаления `ExecuteBatchDcaUseCase` и `SchedulerRepository` код в `src/_wip/dca-scheduling/` перестанет компилироваться. Это ожидаемо? Или нужно временно закомментировать imports?

## References

### Файлы для полного удаления (~1000 строк)

- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/domain/usecases/SimulateSwapUseCase.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/domain/usecases/ExecuteMockPurchaseUseCase.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/domain/usecases/ExecuteBatchDcaUseCase.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/presentation/formatters/SimulateFormatter.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/domain/models/Portfolio.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/domain/models/Purchase.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/domain/models/SchedulerState.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/domain/repositories/PortfolioRepository.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/domain/repositories/PurchaseRepository.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/domain/repositories/SchedulerRepository.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/data/repositories/sqlite/SQLitePortfolioRepository.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/data/repositories/sqlite/SQLitePurchaseRepository.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/data/repositories/sqlite/SQLiteSchedulerRepository.ts`

### Файлы для модификации

- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/index.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/presentation/commands/handlers.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/presentation/commands/definitions.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/domain/usecases/index.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/presentation/formatters/index.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/domain/repositories/BlockchainRepository.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/data/repositories/SolanaBlockchainRepository.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/data/sources/api/SolanaRpcClient.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/data/types/database.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/data/sources/database/KyselyDatabase.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/data/sources/database/index.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/data/factories/RepositoryFactory.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/infrastructure/shared/config/envSchema.ts`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/.env.example`
- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/README.md`

### Директория НЕ для удаления (оставить как есть)

- `/Users/artem/.claude-worktrees/DCATgBot/cranky-leavitt/src/_wip/dca-scheduling/`
