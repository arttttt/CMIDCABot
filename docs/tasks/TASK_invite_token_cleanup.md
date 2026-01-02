<!-- GitHub Issue: #202 -->
# Task: Invite Token Cleanup

## Context

Метод `InviteTokenRepository.deleteExpired()` существует, но не подключён к `CleanupScheduler`. Истёкшие invite-токены накапливаются в БД бесконечно. Задача — подключить репозиторий к существующему scheduler с поддержкой индивидуального интервала очистки.

## Acceptance Criteria

- [x] `CleanupScheduler` поддерживает регистрацию store с индивидуальным интервалом
- [x] Интерфейс `InviteTokenRepository` расширяет `CleanableStore`
- [x] `SQLiteInviteTokenRepository` подключён к `CleanupScheduler` в `src/index.ts`
- [x] При удалении записей логируется количество на уровне DEBUG
- [x] Существующие stores (`secretCache`, `importSessionCache`) продолжают работать с интервалом 1 минута

## Scope

- Рефакторинг `CleanupScheduler` для поддержки per-store интервалов
- Расширение интерфейса `InviteTokenRepository` от `CleanableStore`
- Подключение `inviteTokenRepository` к scheduler в `src/index.ts`
- DEBUG-логирование количества удалённых записей

## Out of Scope

- Изменение логики `deleteExpired()` в `SQLiteInviteTokenRepository`
- Конфигурация интервала через environment variables
- UI/команды для ручной очистки токенов
- Метрики и мониторинг очистки

## Technical Notes

**Текущая структура CleanupScheduler:**
```typescript
// src/infrastructure/shared/scheduling/CleanupScheduler.ts
constructor(
  private readonly stores: CleanableStore[],
  private readonly intervalMs: number = DEFAULT_CLEANUP_INTERVAL_MS,
)
```

**Предлагаемый подход — конфиг через конструктор:**
```typescript
interface CleanableEntry {
  store: CleanableStore;
  intervalMs: number;
}

new CleanupScheduler([
  { store: secretCache, intervalMs: 60_000 },
  { store: importSessionCache, intervalMs: 60_000 },
  { store: inviteTokenRepository, intervalMs: 3_600_000 },
]);
```

**Интервалы:**
- `secretCache`, `importSessionCache` — 1 минута (текущее поведение)
- `inviteTokenRepository` — рекомендуется 1 час (токены живут дольше)

**Файлы для изменения:**
- `src/infrastructure/shared/scheduling/CleanupScheduler.ts` — рефакторинг
- `src/domain/repositories/InviteTokenRepository.ts` — extends CleanableStore
- `src/index.ts` — подключение inviteTokenRepository к scheduler
