<!-- GitHub Issue: #226 -->

# Task: Remove Test/Simulation Code

## Context

В проекте накопился legacy-код для симуляции и mock-покупок с раннего этапа разработки. Этот код увеличивает сложность кодовой базы, создаёт технический долг и смешивает mock-логику с production-кодом. Необходимо удалить весь тестовый/симуляционный код одним рефакторингом.

## Acceptance Criteria

- [x] Удалены файлы Swap Simulation (SimulateSwapUseCase.ts, SimulateFormatter.ts)
- [x] Удалена команда `/swap simulate` из handlers.ts
- [x] Удалён метод `simulateTransaction()` из BlockchainRepository и реализаций
- [x] Удалены файлы Mock Purchase System (ExecuteMockPurchaseUseCase.ts, ExecuteBatchDcaUseCase.ts)
- [x] Удалены domain models: Portfolio.ts, Purchase.ts, SchedulerState.ts
- [x] Удалены repository interfaces: PortfolioRepository.ts, PurchaseRepository.ts, SchedulerRepository.ts
- [x] Удалены SQLite implementations: SQLitePortfolioRepository.ts, SQLitePurchaseRepository.ts, SQLiteSchedulerRepository.ts
- [x] Очищены database types (MockDatabase, PortfolioTable, PurchasesTable, SchedulerStateTable)
- [x] Удалены mock-функции из KyselyDatabase.ts (createMockDatabase, initMockSchema, etc.)
- [x] Очищен RepositoryFactory.ts (MockRepositories, createMockRepositories)
- [x] Удалён MOCK_DATABASE_PATH из envSchema.ts и .env.example
- [x] Обновлён README.md (удалены упоминания mock database)
- [x] Закомментированы сломанные импорты в src/_wip/dca-scheduling/DcaScheduler.ts с TODO-пометкой
- [x] Проект компилируется без ошибок (`npm run build`)
- [ ] Линтер проходит без ошибок (`npm run lint`) — есть предсуществующие ошибки boundaries

## Scope

### Файлы для полного удаления (13 файлов)

**Swap Simulation:**
- `src/domain/usecases/SimulateSwapUseCase.ts`
- `src/presentation/formatters/SimulateFormatter.ts`

**Mock Purchase System:**
- `src/domain/usecases/ExecuteMockPurchaseUseCase.ts`
- `src/domain/usecases/ExecuteBatchDcaUseCase.ts`

**Mock Database — модели:**
- `src/domain/models/Portfolio.ts`
- `src/domain/models/Purchase.ts`
- `src/domain/models/SchedulerState.ts`

**Mock Database — интерфейсы репозиториев:**
- `src/domain/repositories/PortfolioRepository.ts`
- `src/domain/repositories/PurchaseRepository.ts`
- `src/domain/repositories/SchedulerRepository.ts`

**Mock Database — SQLite-реализации:**
- `src/data/repositories/sqlite/SQLitePortfolioRepository.ts`
- `src/data/repositories/sqlite/SQLitePurchaseRepository.ts`
- `src/data/repositories/sqlite/SQLiteSchedulerRepository.ts`

### Файлы для модификации (16 файлов)

| Файл | Изменения |
|------|-----------|
| `src/presentation/commands/handlers.ts` | Удалить createSwapSimulateCommand, simulateSwap из deps, импорты |
| `src/presentation/commands/definitions.ts` | Убрать "simulate" из описания swap команды |
| `src/domain/usecases/index.ts` | Удалить экспорты SimulateSwapUseCase, ExecuteMockPurchaseUseCase, ExecuteBatchDcaUseCase |
| `src/presentation/formatters/index.ts` | Удалить экспорт SimulateFormatter |
| `src/domain/repositories/BlockchainRepository.ts` | Удалить SimulationResult interface, simulateTransaction() метод |
| `src/data/repositories/SolanaBlockchainRepository.ts` | Удалить реализацию simulateTransaction() |
| `src/data/sources/api/SolanaRpcClient.ts` | Удалить метод симуляции транзакции |
| `src/data/types/database.ts` | Удалить MockDatabase, PortfolioTable, PurchasesTable, SchedulerStateTable |
| `src/data/sources/database/KyselyDatabase.ts` | Удалить createMockDatabase(), initMockSchema(), resetMockDatabaseIfNeeded(), dropAllMockTables(), MOCK_SCHEMA_VERSION |
| `src/data/sources/database/index.ts` | Удалить экспорт createMockDatabase |
| `src/data/factories/RepositoryFactory.ts` | Удалить MockRepositories interface, createMockRepositories(), импорты |
| `src/infrastructure/shared/config/envSchema.ts` | Удалить MOCK_DATABASE_PATH, mockPath |
| `src/index.ts` | Удалить создание mock use cases, mockDb, mock repositories, упростить deleteUserData |
| `.env.example` | Удалить MOCK_DATABASE_PATH |
| `README.md` | Удалить упоминания mock database |
| `src/_wip/dca-scheduling/DcaScheduler.ts` | Закомментировать сломанные импорты с пометкой TODO |

### Порядок выполнения

1. **Swap Simulation** — удалить файлы, очистить handlers/definitions, удалить экспорты, очистить BlockchainRepository
2. **Mock Purchase System** — удалить файлы use cases, удалить экспорты, очистить src/index.ts
3. **Mock Database** — удалить models, repository interfaces, SQLite implementations, очистить database types и KyselyDatabase
4. **Cleanup** — обновить envSchema, .env.example, README, закомментировать импорты в DcaScheduler.ts
5. **Верификация** — npm run build, npm run lint

## Out of Scope

- Логика файлов в `src/_wip/dca-scheduling/` — только комментирование импортов, без изменения логики
- Рефакторинг DCA Scheduler — отдельная задача
- Добавление новой функциональности
- Изменение production-кода (swap execute, quote и т.д.)

## Technical Notes

- При комментировании импортов в DcaScheduler.ts использовать формат:
  ```typescript
  // TODO: restore after DcaScheduler refactoring
  // import { ExecuteBatchDcaUseCase } from '../../domain/usecases';
  ```
- Проверить что удаление SimulationResult не ломает другие части BlockchainRepository
- После удаления mockDb из src/index.ts убедиться что deleteUserData корректно работает без mock repositories
- Ориентировочный объём удаляемого кода: ~1000 строк
