# Brief: Объединение MainDB и MockDB

## Problem Statement

DELETE операции в `DeleteUserDataUseCase` не атомарны — при сбое одной операции данные остаются в несогласованном состоянии.

**Причина:** данные пользователя хранятся в двух разных SQLite файлах:
- `main.db` — users, transactions
- `mock.db` — portfolio, purchases, scheduler_state

SQLite не поддерживает транзакции между разными файлами баз данных.

**Проблемный код** (`src/domain/usecases/DeleteUserDataUseCase.ts:38-47`):
```typescript
await this.userRepository.delete(targetTelegramId);
await this.transactionRepository.deleteByUserId(targetTelegramId);
await this.portfolioRepository?.deleteByUserId(targetTelegramId);
await this.purchaseRepository?.deleteByUserId(targetTelegramId);
```

## Current State

| База | Файл | Таблицы | Когда используется |
|------|------|---------|-------------------|
| MainDB | `main.db` | users, transactions | всегда |
| MockDB | `mock.db` | portfolio, purchases, scheduler_state | только isDev |
| AuthDB | `auth.db` | authorized_users, invite_tokens | всегда |

MockDB изначально создавалась для dev-режима, но разделение усложняет архитектуру и делает невозможной атомарность операций.

## Proposed Solution

Объединить MainDB и MockDB в единую базу данных.

**После слияния:**

| База | Файл | Таблицы |
|------|------|---------|
| MainDB | `main.db` | users, transactions, portfolio, purchases, scheduler_state |
| AuthDB | `auth.db` | authorized_users, invite_tokens |

**Результат:** все 5 таблиц в одном файле → возможна полноценная SQLite транзакция на все DELETE операции.

## Technical Context

### Затронутые файлы

**Типы:**
- `src/data/types/database.ts` — удалить `MockDatabase`, перенести таблицы в `MainDatabase`

**Схема БД:**
- `src/data/sources/database/KyselyDatabase.ts` — добавить CREATE TABLE в `initMainSchema`, удалить `createMockDatabase` и связанные функции

**Репозитории (изменить `Kysely<MockDatabase>` → `Kysely<MainDatabase>`):**
- `src/data/repositories/sqlite/SQLitePortfolioRepository.ts`
- `src/data/repositories/sqlite/SQLitePurchaseRepository.ts`
- `src/data/repositories/sqlite/SQLiteSchedulerRepository.ts`

**Фабрика:**
- `src/data/factories/RepositoryFactory.ts` — убрать `createMockRepositories`, расширить `createMainRepositories`

**Точка входа:**
- `src/index.ts` — убрать `mockDb`, использовать `mainDb` везде

**Целевой use case:**
- `src/domain/usecases/DeleteUserDataUseCase.ts` — обернуть delete операции в единую транзакцию

### Зависимости

- Kysely поддерживает транзакции через `db.transaction().execute()`
- InMemory репозитории не затрагиваются (используются в memory-режиме)
- AuthDB остаётся отдельной (другая ответственность — авторизация)

## Suggested Approach

1. **Обновить типы** (`database.ts`)
   - Перенести PortfolioTable, PurchasesTable, SchedulerStateTable в MainDatabase
   - Удалить интерфейс MockDatabase

2. **Обновить схему БД** (`KyselyDatabase.ts`)
   - Добавить CREATE TABLE для portfolio, purchases, scheduler_state в `initMainSchema`
   - Удалить `createMockDatabase`, `initMockSchema`, `resetMockDatabaseIfNeeded` и связанные функции

3. **Обновить репозитории**
   - В трёх SQLite репозиториях заменить `Kysely<MockDatabase>` на `Kysely<MainDatabase>`

4. **Обновить фабрику** (`RepositoryFactory.ts`)
   - Удалить `createMockRepositories` и `MockRepositories`
   - Добавить portfolio/purchase/scheduler репозитории в `createMainRepositories`

5. **Обновить точку входа** (`index.ts`)
   - Убрать создание `mockDb`
   - Передавать `mainDb` во все репозитории

6. **Добавить атомарность** (`DeleteUserDataUseCase.ts`)
   - Обернуть все delete операции в единую транзакцию
   - Потребуется передать db instance или создать метод `deleteAllUserData` в репозитории

## Out of Scope

- **Миграция данных** — бот не в продакшене, существующие mock.db данные можно потерять
- **Изменение AuthDB** — остаётся отдельной базой
- **Изменение InMemory репозиториев** — они не используют файлы БД

## Open Questions for PM

1. **Приоритет задачи?** — блокирует ли это другие задачи?
2. **Нужен ли откат?** — возможность вернуть две БД, если потребуется?

## References

### Файлы для изменения
- `src/data/types/database.ts`
- `src/data/sources/database/KyselyDatabase.ts`
- `src/data/sources/database/index.ts`
- `src/data/repositories/sqlite/SQLitePortfolioRepository.ts`
- `src/data/repositories/sqlite/SQLitePurchaseRepository.ts`
- `src/data/repositories/sqlite/SQLiteSchedulerRepository.ts`
- `src/data/factories/RepositoryFactory.ts`
- `src/index.ts`
- `src/domain/usecases/DeleteUserDataUseCase.ts`

### Связанные интерфейсы
- `src/domain/repositories/PortfolioRepository.ts`
- `src/domain/repositories/PurchaseRepository.ts`
- `src/domain/repositories/SchedulerRepository.ts`
