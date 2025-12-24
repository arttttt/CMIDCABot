# Task: Удаление Legacy In-Memory Storage

## Context

В проекте остались артефакты ранней стадии разработки: переключатель `DB_MODE`, 7 InMemory-репозиториев, дублирующих SQLite-версии, и условная логика в фабрике/index.ts. Это мёртвый код, который усложняет понимание проекта.

## Acceptance Criteria

- [ ] `DB_MODE` удалён из `envSchema.ts` (схема, тип, интерфейс)
- [ ] `DB_MODE` удалён из `.env.example`
- [ ] 7 legacy InMemory-репозиториев удалены
- [ ] `RepositoryFactory.ts` упрощён — только SQLite, параметр `db` обязателен
- [ ] `index.ts` не содержит ветвлений по `dbMode`
- [ ] Директория `repositories/memory/` переименована в `repositories/cache/`
- [ ] Barrel export обновлён (только 3 легитимных файла)
- [ ] `npm run build` проходит без ошибок
- [ ] `npm run lint` проходит без ошибок

## Scope

### Изменить (5 файлов)

| Файл | Что сделать |
|------|-------------|
| `src/infrastructure/shared/config/envSchema.ts` | Удалить `DB_MODE`, `DatabaseMode`, `mode` из `DatabaseConfig` |
| `src/data/factories/RepositoryFactory.ts` | Убрать `mode`, убрать импорты legacy, `db` обязателен |
| `src/index.ts` | Убрать `dbMode`, ветвления, импорты legacy репозиториев |
| `src/data/repositories/memory/index.ts` → `cache/index.ts` | Переименовать, оставить 3 экспорта |
| `.env.example` | Удалить строку `DB_MODE=...` |

### Удалить (7 файлов)

```
src/data/repositories/memory/InMemoryUserRepository.ts
src/data/repositories/memory/InMemoryTransactionRepository.ts
src/data/repositories/memory/InMemoryPortfolioRepository.ts
src/data/repositories/memory/InMemoryPurchaseRepository.ts
src/data/repositories/memory/InMemorySchedulerRepository.ts
src/data/repositories/memory/InMemoryAuthRepository.ts
src/data/repositories/memory/InMemoryInviteTokenRepository.ts
```

### Переименовать

```
src/data/repositories/memory/ → src/data/repositories/cache/
```

### Оставить (3 файла, переедут в cache/)

```
CachedBalanceRepository.ts
InMemorySecretRepository.ts
InMemoryImportSessionRepository.ts
```

## Out of Scope

- Миграции данных
- Добавление тестов
- Рефакторинг оставшихся кэшей

## Technical Notes

- Порядок выполнения: конфиг → фабрика → index.ts → удаление файлов → переименование директории → barrel export
- После переименования `memory/` → `cache/` обновить все импорты в проекте
- Легитимные кэши (`SecretCache`, `ImportSessionCache` в `sources/memory/`) НЕ трогать

## Open Questions

Нет — все вопросы закрыты.

## References

- [Brief](../briefs/BRIEF_remove_legacy_storage.md)
- `prompts/ARCHITECTURE.md` — архитектура проекта
