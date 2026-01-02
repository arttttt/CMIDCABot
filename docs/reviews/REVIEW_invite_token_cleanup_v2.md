<!-- GitHub Issue: #202 -->
# Code Review: Invite Token Cleanup (v2)

**Previous review:** `docs/reviews/REVIEW_invite_token_cleanup.md`
**Reviewed:**
- `src/domain/repositories/InviteTokenRepository.ts`
- `src/data/repositories/sqlite/SQLiteInviteTokenRepository.ts`
- `src/infrastructure/shared/scheduling/CleanupScheduler.ts`
- `src/index.ts` (lines 166-171)

**Date:** 2026-01-02
**Status:** 🟢 Approved

## Summary

Все замечания из предыдущего review исправлены корректно. Архитектурное нарушение устранено — domain layer больше не зависит от infrastructure. Логирование улучшено добавлением идентификации store.

## Fixed Issues

### [S1] `deleteExpired()` не должен быть частью `InviteTokenRepository`

**Status:** Исправлено

**Verification:**
- `InviteTokenRepository` (строки 8-28) теперь чистый domain интерфейс без `extends CleanableStore`
- Метод `deleteExpired()` удален из контракта репозитория
- `SQLiteInviteTokenRepository` (строка 14) корректно реализует оба интерфейса: `implements InviteTokenRepository, CleanableStore`

```typescript
// src/domain/repositories/InviteTokenRepository.ts
export interface InviteTokenRepository {
  create(...): Promise<void>;
  getByToken(...): Promise<InviteToken | undefined>;
  markUsed(...): Promise<boolean>;
  getByCreator(...): Promise<InviteToken[]>;
  // deleteExpired() отсутствует - корректно
}

// src/data/repositories/sqlite/SQLiteInviteTokenRepository.ts
export class SQLiteInviteTokenRepository implements InviteTokenRepository, CleanableStore {
  // deleteExpired() - реализация CleanableStore, не часть InviteTokenRepository
}
```

### [S2] Отсутствует идентификация store в логах

**Status:** Исправлено

**Verification:**
- `CleanableEntry` теперь содержит обязательное поле `name: string` (строка 21)
- Логи включают `store: entry.name` (строки 43, 50)
- В `src/index.ts` все entry имеют понятные имена:

```typescript
// src/index.ts:166-170
const cleanupScheduler = new CleanupScheduler([
  { store: secretCache, intervalMs: 60_000, name: "secretCache" },
  { store: importSessionCache, intervalMs: 60_000, name: "importSessionCache" },
  { store: inviteTokenRepository, intervalMs: 3_600_000, name: "inviteTokenRepository" },
]);
```

## New Findings

### 🔴 Critical (must fix)

Нет критических проблем.

### 🟡 Should Fix

Нет проблем требующих исправления.

### 🟢 Consider

#### [N1] Магические числа для интервалов (из v1, не исправлено)

**Location:** `src/index.ts:167-169`

**Issue:** Интервалы `60_000` и `3_600_000` указаны как magic numbers.

**Note:** Это было отмечено как "Consider" в предыдущем review и не являлось обязательным для исправления. Оставлено как рекомендация на будущее.

## Checklist

- [x] Matches acceptance criteria
- [x] Follows ARCHITECTURE.md
- [x] No security issues
- [x] Code quality acceptable

## Verdict

**Approved.** Все обязательные замечания ([S1], [S2]) исправлены корректно. Архитектура Clean Architecture соблюдена — domain layer не зависит от infrastructure. Код готов к merge.
