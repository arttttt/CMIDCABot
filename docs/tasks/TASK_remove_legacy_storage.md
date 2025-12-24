# Task: Удаление Legacy In-Memory Storage

## Context

В проекте сохранились артефакты ранней стадии разработки:
- Переключатель `DB_MODE` (sqlite/memory) в конфигурации
- 7 InMemory-репозиториев, дублирующих SQLite-версии
- Условная логика создания репозиториев в `RepositoryFactory` и `index.ts`

**Проблема:** Лишний код, cognitive load, путаница при onboarding, мёртвый код не тестируется.

**Решение:** Удалить legacy, оставить только SQLite. Легитимные кэши сохранить и переместить в `cache/`.

## Визуализация изменений

```
src/data/repositories/
├── memory/                    → ПЕРЕИМЕНОВАТЬ в cache/
│   ├── InMemoryUserRepository.ts        ✗ УДАЛИТЬ
│   ├── InMemoryTransactionRepository.ts ✗ УДАЛИТЬ
│   ├── InMemoryPortfolioRepository.ts   ✗ УДАЛИТЬ
│   ├── InMemoryPurchaseRepository.ts    ✗ УДАЛИТЬ
│   ├── InMemorySchedulerRepository.ts   ✗ УДАЛИТЬ
│   ├── InMemoryAuthRepository.ts        ✗ УДАЛИТЬ
│   ├── InMemoryInviteTokenRepository.ts ✗ УДАЛИТЬ
│   ├── InMemorySecretRepository.ts      ✓ ОСТАВИТЬ
│   ├── InMemoryImportSessionRepository.ts ✓ ОСТАВИТЬ
│   ├── CachedBalanceRepository.ts       ✓ ОСТАВИТЬ
│   └── index.ts                         ✎ ОБНОВИТЬ
└── sqlite/                    → НЕ ТРОГАТЬ
```

## Acceptance Criteria

### Этап 1: Конфигурация
- [ ] Из `envSchema.ts` удалён `DB_MODE` (строка 32)
- [ ] Из `envSchema.ts` удалён `DB_MODE` из `FORBIDDEN_IN_PRODUCTION` (строка 10)
- [ ] Из `envSchema.ts` удалён тип `DatabaseMode` (строка 125)
- [ ] Из `envSchema.ts` удалён `mode` из интерфейса `DatabaseConfig`
- [ ] Из `.env.example` удалена строка `DB_MODE=...`

### Этап 2: RepositoryFactory
- [ ] Убран параметр `mode` из `createMainRepositories()`
- [ ] Убран параметр `mode` из `createMockRepositories()`
- [ ] Параметр `db` стал обязательным (не optional)
- [ ] Удалены импорты 5 legacy InMemory репозиториев
- [ ] Убраны ветвления `if (mode === "memory")`
- [ ] Функции возвращают только SQLite репозитории

### Этап 3: index.ts
- [ ] Удалена переменная `dbMode`
- [ ] Удалён вывод `Database mode: ${dbMode}`
- [ ] Удалены условия `if (dbMode === "sqlite")`
- [ ] Удалены импорты `InMemoryAuthRepository`, `InMemoryInviteTokenRepository`
- [ ] `mainDb` и `authDb` создаются всегда (не в условии)
- [ ] Auth/InviteToken репозитории всегда SQLite

### Этап 4: Удаление legacy файлов
- [ ] Удалён `InMemoryUserRepository.ts`
- [ ] Удалён `InMemoryTransactionRepository.ts`
- [ ] Удалён `InMemoryPortfolioRepository.ts`
- [ ] Удалён `InMemoryPurchaseRepository.ts`
- [ ] Удалён `InMemorySchedulerRepository.ts`
- [ ] Удалён `InMemoryAuthRepository.ts`
- [ ] Удалён `InMemoryInviteTokenRepository.ts`

### Этап 5: Переименование и barrel export
- [ ] Директория `repositories/memory/` переименована в `repositories/cache/`
- [ ] Обновлены все импорты в проекте (ищи `/memory/`)
- [ ] `cache/index.ts` экспортирует только 3 файла:
  - `CachedBalanceRepository`
  - `InMemorySecretRepository`
  - `InMemoryImportSessionRepository`

### Этап 6: Проверка
- [ ] `npm run build` — без ошибок
- [ ] `npm run lint` — без ошибок

## Scope

### Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `src/infrastructure/shared/config/envSchema.ts` | Удалить DB_MODE, DatabaseMode, mode из DatabaseConfig |
| `src/data/factories/RepositoryFactory.ts` | Убрать mode, сделать db обязательным, только SQLite |
| `src/index.ts` | Убрать dbMode, ветвления, legacy импорты |
| `src/data/repositories/cache/index.ts` | Оставить 3 экспорта |
| `.env.example` | Удалить DB_MODE |

### Файлы для удаления (7 штук)

```
src/data/repositories/memory/InMemoryUserRepository.ts
src/data/repositories/memory/InMemoryTransactionRepository.ts
src/data/repositories/memory/InMemoryPortfolioRepository.ts
src/data/repositories/memory/InMemoryPurchaseRepository.ts
src/data/repositories/memory/InMemorySchedulerRepository.ts
src/data/repositories/memory/InMemoryAuthRepository.ts
src/data/repositories/memory/InMemoryInviteTokenRepository.ts
```

### НЕ трогать

```
src/data/sources/memory/SecretCache.ts         # Легитимный кэш
src/data/sources/memory/ImportSessionCache.ts  # Легитимный кэш
src/data/sources/memory/index.ts               # Их barrel
```

## Out of Scope

- Переименование `sources/memory/` (там легитимные кэши, название корректно)
- Миграции данных
- Добавление тестов
- Рефакторинг оставшихся кэшей

## Technical Notes

1. **Порядок выполнения критичен:** конфиг → фабрика → index.ts → удаление → переименование → импорты
2. **После переименования:** найти все импорты `/memory/` и заменить на `/cache/`
3. **mockDb:** проверить, создаётся ли он и нужен ли (в брифе упоминается `createMockDatabase`)

## Impact Assessment

| Метрика | До | После |
|---------|-----|-------|
| Файлов в memory/ | 11 | 0 |
| Файлов в cache/ | 0 | 4 |
| Строк кода | ~400 | ~150 |
| Конфиг параметров | DB_MODE + пути | только пути |
| Ветвлений по mode | 4 | 0 |

## Open Questions

Нет — все вопросы закрыты.

## References

- [Brief](../briefs/BRIEF_remove_legacy_storage.md) — технический анализ SA
- `prompts/ARCHITECTURE.md` — архитектура проекта
- `src/infrastructure/shared/config/envSchema.ts` — конфигурация
- `src/data/factories/RepositoryFactory.ts` — фабрика
- `src/index.ts:100-180` — инициализация
