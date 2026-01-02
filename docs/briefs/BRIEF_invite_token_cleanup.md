<!-- GitHub Issue: #202 -->
# Brief: Invite Token Cleanup

## Problem Statement

`InviteTokenRepository.deleteExpired()` существует, но не подключён к `CleanupScheduler`. Истёкшие invite-токены накапливаются в БД бесконечно.

## Proposed Solution

Подключить `InviteTokenRepository` к существующему `CleanupScheduler`.

## Technical Context

**CleanableStore interface** (`src/domain/stores/CleanableStore.ts`):
```typescript
interface CleanableStore {
  deleteExpired(): Promise<number>;
}
```

**SQLiteInviteTokenRepository** уже имеет метод `deleteExpired()` с правильной сигнатурой (строки 68-76).

**Текущая инициализация** (`src/index.ts:166`):
```typescript
const cleanupScheduler = new CleanupScheduler([secretCache, importSessionCache]);
// InviteTokenRepository не включён
```

## Suggested Approach

Расширить интерфейс `InviteTokenRepository` от `CleanableStore`:
- Явная типизация
- Контракт интерфейса отражает реальные требования

## Open Questions for PM

1. Частота очистки — текущий интервал 1 минута, подходит ли для токенов?
2. Нужно ли логирование количества удалённых токенов?

## References

- `src/index.ts` — инициализация CleanupScheduler
- `src/domain/repositories/InviteTokenRepository.ts` — интерфейс
- `src/infrastructure/repositories/SQLiteInviteTokenRepository.ts` — реализация deleteExpired()
- `src/domain/stores/CleanableStore.ts` — интерфейс CleanableStore
