# Brief: Удаление Legacy In-Memory Storage

## Problem Statement

В проекте сохранились артефакты ранней стадии разработки:
- Переключатель `DB_MODE` (sqlite/memory) в конфигурации
- 7 InMemory-репозиториев, дублирующих SQLite-версии
- Условная логика создания репозиториев в `RepositoryFactory` и `index.ts`

Это создаёт:
- Лишний код и cognitive load
- Путаницу при onboarding
- Мёртвый код, который не тестируется в production

## Proposed Solution

Удалить legacy in-memory storage полностью, оставив только SQLite как единственный режим персистентности. Легитимные in-memory кэши (секреты, сессии импорта, балансы) сохранить.

## Technical Context

### Текущая архитектура

```
src/data/
├── repositories/
│   ├── memory/           # 10 файлов
│   │   ├── InMemoryUserRepository.ts        ← УДАЛИТЬ (legacy)
│   │   ├── InMemoryTransactionRepository.ts ← УДАЛИТЬ (legacy)
│   │   ├── InMemoryPortfolioRepository.ts   ← УДАЛИТЬ (legacy)
│   │   ├── InMemoryPurchaseRepository.ts    ← УДАЛИТЬ (legacy)
│   │   ├── InMemorySchedulerRepository.ts   ← УДАЛИТЬ (legacy)
│   │   ├── InMemoryAuthRepository.ts        ← УДАЛИТЬ (legacy)
│   │   ├── InMemoryInviteTokenRepository.ts ← УДАЛИТЬ (legacy)
│   │   ├── InMemorySecretRepository.ts      ← ОСТАВИТЬ (by design)
│   │   ├── InMemoryImportSessionRepository.ts ← ОСТАВИТЬ (by design)
│   │   ├── CachedBalanceRepository.ts       ← ОСТАВИТЬ (cache)
│   │   └── index.ts                         ← ОБНОВИТЬ
│   └── sqlite/           # SQLite версии всех репозиториев
├── sources/
│   └── memory/           # Легитимные кэши
│       ├── SecretCache.ts       ← ОСТАВИТЬ
│       ├── ImportSessionCache.ts ← ОСТАВИТЬ
│       └── index.ts
└── factories/
    └── RepositoryFactory.ts     ← УПРОСТИТЬ
```

### Файлы для изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `src/infrastructure/shared/config/envSchema.ts` | Изменить | Удалить `DB_MODE`, тип `DatabaseMode` |
| `src/data/factories/RepositoryFactory.ts` | Изменить | Убрать параметр `mode`, только SQLite |
| `src/index.ts` | Изменить | Убрать ветвления по `dbMode` |
| `src/data/repositories/memory/index.ts` | Изменить | Убрать экспорты удалённых файлов |
| `.env.example` | Изменить | Удалить `DB_MODE` |

### Файлы для удаления (7 файлов)

```
src/data/repositories/memory/InMemoryUserRepository.ts
src/data/repositories/memory/InMemoryTransactionRepository.ts
src/data/repositories/memory/InMemoryPortfolioRepository.ts
src/data/repositories/memory/InMemoryPurchaseRepository.ts
src/data/repositories/memory/InMemorySchedulerRepository.ts
src/data/repositories/memory/InMemoryAuthRepository.ts
src/data/repositories/memory/InMemoryInviteTokenRepository.ts
```

### Файлы НЕ трогать (легитимные)

```
src/data/repositories/memory/InMemorySecretRepository.ts   # Одноразовые секреты, TTL 5 мин
src/data/repositories/memory/InMemoryImportSessionRepository.ts  # Сессии импорта
src/data/repositories/memory/CachedBalanceRepository.ts    # Кэш балансов поверх RPC
src/data/sources/memory/SecretCache.ts
src/data/sources/memory/ImportSessionCache.ts
```

## Suggested Approach

### Этап 1: Удаление конфигурации DB_MODE

1. `envSchema.ts`:
   - Удалить `DB_MODE` из схемы (строка 32)
   - Удалить из `FORBIDDEN_IN_PRODUCTION` (строка 10)
   - Удалить тип `DatabaseMode` (строка 125)
   - Удалить `mode` из `DatabaseConfig` interface

2. `.env.example`:
   - Удалить строку `DB_MODE=sqlite`

### Этап 2: Упрощение RepositoryFactory

`src/data/factories/RepositoryFactory.ts`:
- Убрать параметр `mode` из функций
- Убрать импорты InMemory репозиториев (legacy)
- Оставить только создание SQLite репозиториев
- Сделать `db` обязательным параметром (не optional)

### Этап 3: Упрощение index.ts

`src/index.ts`:
- Убрать переменную `dbMode`
- Убрать вывод `Database mode: ${dbMode}`
- Убрать условия `if (dbMode === "sqlite")`
- Убрать условия `if (dbMode === "memory")`
- Убрать импорты `InMemoryAuthRepository`, `InMemoryInviteTokenRepository`
- Всегда создавать SQLite репозитории

### Этап 4: Удаление legacy файлов

Удалить 7 файлов InMemory репозиториев (см. список выше).

### Этап 5: Обновление barrel export

`src/data/repositories/memory/index.ts`:
- Убрать экспорты удалённых файлов
- Оставить только:
  - `InMemorySecretRepository`
  - `InMemoryImportSessionRepository`
  - `CachedBalanceRepository`

### Этап 6: Проверка

```bash
npm run build
npm run lint
```

## Open Questions for PM

1. **Нужна ли миграция?** — Если у кого-то `DB_MODE=memory` в .env, после изменений приложение упадёт. Нужно ли логировать deprecation warning?

2. **Переименование директории?** — После удаления legacy репозиториев в `memory/` останутся только кэши. Стоит ли переименовать в `cache/`?

3. **Тесты?** — Были ли тесты, использующие memory mode? Нужно ли их обновить?

## Impact Assessment

| Метрика | До | После |
|---------|-----|-------|
| Файлов в memory/ | 11 | 4 |
| Строк кода | ~400 | ~150 |
| Конфиг параметров | DB_MODE + 2 пути | 2 пути |
| Ветвлений по mode | 4 | 0 |

## References

- `src/infrastructure/shared/config/envSchema.ts` — конфигурация
- `src/data/factories/RepositoryFactory.ts` — фабрика репозиториев
- `src/index.ts:100-180` — инициализация приложения
- `prompts/ARCHITECTURE.md` — архитектура проекта
