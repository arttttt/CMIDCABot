# Task: Объединение MainDB и MockDB для атомарных операций

## Context

DELETE операции в `DeleteUserDataUseCase` не атомарны — 4 последовательных вызова к разным репозиториям. При сбое одной операции данные остаются в несогласованном состоянии. Причина: данные в двух разных SQLite файлах (`main.db` и `mock.db`). Решение: объединить в одну БД для возможности единой транзакции.

## Acceptance Criteria

- [ ] `MockDatabase` удалён из типов, таблицы portfolio/purchases/scheduler_state перенесены в `MainDatabase`
- [ ] Единый файл `main.db` содержит 5 таблиц: users, transactions, portfolio, purchases, scheduler_state
- [ ] `createMockDatabase`, `initMockSchema`, `resetMockDatabaseIfNeeded` удалены из `KyselyDatabase.ts`
- [ ] CREATE TABLE для portfolio/purchases/scheduler_state добавлены в `initMainSchema`
- [ ] Репозитории `SQLitePortfolioRepository`, `SQLitePurchaseRepository`, `SQLiteSchedulerRepository` используют `Kysely<MainDatabase>`
- [ ] `createMockRepositories` и `MockRepositories` удалены из `RepositoryFactory.ts`
- [ ] Portfolio/Purchase/Scheduler репозитории добавлены в `createMainRepositories`
- [ ] `mockDb` удалён из `index.ts`, все репозитории используют `mainDb`
- [ ] DELETE в `DeleteUserDataUseCase` выполняется в единой транзакции Kysely
- [ ] `.env.example` актуализирован — `DB_MOCK_PATH` удалена (если есть)
- [ ] Конфигурация `mockPath` удалена из `config/`
- [ ] Бот запускается и работает в dev-режиме
- [ ] Бот запускается и работает в prod-режиме

## Scope

- Слияние MainDB и MockDB в одну базу
- Удаление MockDatabase типа и связанной инфраструктуры
- Рефакторинг репозиториев и фабрики
- Атомарность delete операций через транзакцию

## Out of Scope

- Миграция существующих данных (бот не в проде)
- Изменение AuthDB (остаётся отдельной)
- Изменение InMemory репозиториев

## Technical Notes

### Затронутые файлы

**Типы:**
- `src/data/types/database.ts`

**Схема БД:**
- `src/data/sources/database/KyselyDatabase.ts`
- `src/data/sources/database/index.ts`

**Репозитории:**
- `src/data/repositories/sqlite/SQLitePortfolioRepository.ts`
- `src/data/repositories/sqlite/SQLitePurchaseRepository.ts`
- `src/data/repositories/sqlite/SQLiteSchedulerRepository.ts`

**Фабрика:**
- `src/data/factories/RepositoryFactory.ts`

**Точка входа:**
- `src/index.ts`

**Use Case:**
- `src/domain/usecases/DeleteUserDataUseCase.ts`

**Конфигурация:**
- `src/infrastructure/shared/config/` (проверить mockPath)
- `.env.example`

### Kysely транзакции

```typescript
await db.transaction().execute(async (trx) => {
  await trx.deleteFrom("purchases").where("telegram_id", "=", odId).execute();
  await trx.deleteFrom("portfolio").where("telegram_id", "=", userId).execute();
  await trx.deleteFrom("transactions").where("telegram_id", "=", userId).execute();
  await trx.deleteFrom("users").where("telegram_id", "=", userId).execute();
});
```

## Open Questions

Нет.
