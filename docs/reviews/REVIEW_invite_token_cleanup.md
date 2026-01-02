<!-- GitHub Issue: #202 -->
# Code Review: Invite Token Cleanup

**Reviewed:**
- `src/infrastructure/shared/scheduling/CleanupScheduler.ts`
- `src/infrastructure/shared/scheduling/index.ts`
- `src/domain/repositories/InviteTokenRepository.ts`
- `src/index.ts` (lines 95, 166-171)

**Date:** 2026-01-02
**Status:** 🟡 Approved with comments

## Summary

Реализация соответствует всем acceptance criteria. CleanupScheduler успешно рефакторен для поддержки per-store интервалов, InviteTokenRepository расширяет CleanableStore, и inviteTokenRepository подключен к scheduler с интервалом 1 час. Код чистый и следует архитектуре проекта. Обнаружено одно нарушение архитектуры (domain -> infrastructure/shared/scheduling), которое следует исправить.

## Findings

### 🔴 Critical (must fix)

Нет критических проблем.

### 🟡 Should Fix

#### [S1] `deleteExpired()` не должен быть частью `InviteTokenRepository`

**Location:** `src/domain/repositories/InviteTokenRepository.ts:7-9`

**Issue:** Интерфейс `InviteTokenRepository` расширяет `CleanableStore`, что:
1. Создаёт зависимость domain → infrastructure (нарушение Clean Architecture)
2. Добавляет `deleteExpired()` в контракт репозитория, хотя это деталь реализации

**Impact:** Domain layer знает о механизме очистки, который не относится к бизнес-логике репозитория.

**Suggestion:** Убрать `extends CleanableStore` из `InviteTokenRepository`. Реализация `SQLiteInviteTokenRepository` должна напрямую имплементировать `CleanableStore`:
```typescript
// domain/repositories/InviteTokenRepository.ts
export interface InviteTokenRepository {
  create(...): Promise<void>;
  getByToken(...): Promise<InviteToken | undefined>;
  markUsed(...): Promise<boolean>;
  getByCreator(...): Promise<InviteToken[]>;
  // НЕТ deleteExpired()
}

// data/repositories/sqlite/SQLiteInviteTokenRepository.ts
export class SQLiteInviteTokenRepository
  implements InviteTokenRepository, CleanableStore {
  // deleteExpired() — реализация CleanableStore
}
```

#### [S2] Отсутствует идентификация store в логах

**Location:** `src/infrastructure/shared/scheduling/CleanupScheduler.ts:41-44`

**Issue:** При логировании cleanup результата не указывается какой именно store был очищен. Логируется только `deletedCount` и `intervalMs`.

**Impact:** При наличии нескольких stores с одинаковым интервалом невозможно определить какой store произвел очистку. Усложняет отладку.

**Suggestion:** Добавить опциональное поле `name` в `CleanableEntry`:
```typescript
interface CleanableEntry {
  store: CleanableStore;
  intervalMs: number;
  name?: string; // e.g., "secretCache", "inviteTokenRepository"
}
```

### 🟢 Consider

#### [N1] Магические числа для интервалов

**Location:** `src/index.ts:167-169`

**Issue:** Интервалы `60_000` и `3_600_000` указаны как magic numbers.

**Suggestion:** Вынести в именованные константы для лучшей читаемости:
```typescript
const CACHE_CLEANUP_INTERVAL_MS = 60_000;      // 1 minute
const TOKEN_CLEANUP_INTERVAL_MS = 3_600_000;   // 1 hour
```

#### [N2] Потенциальная неэффективность при большом количестве stores

**Location:** `src/infrastructure/shared/scheduling/CleanupScheduler.ts:32-57`

**Issue:** Каждый store получает свой собственный setInterval. При большом количестве stores это создает много таймеров.

**Suggestion:** Для текущего количества stores (3) это не проблема. Если количество stores вырастет, можно рассмотреть группировку по интервалам.

## Action Items

- [ ] [S1] Убрать `extends CleanableStore` из `InviteTokenRepository`, добавить `implements CleanableStore` в `SQLiteInviteTokenRepository`
- [ ] [S2] Добавить идентификацию store в логи cleanup scheduler
- [ ] [N1] Вынести интервалы в именованные константы (опционально)

## Checklist

- [x] Matches acceptance criteria
- [ ] Follows ARCHITECTURE.md (нарушение S1)
- [x] No security issues
- [x] Code quality acceptable

## Verdict

**Approved with comments.** Функциональность реализована корректно. Рекомендуется исправить [S1] — убрать `deleteExpired()` из контракта `InviteTokenRepository` и оставить только на реализации. Issue [S2] желательно исправить для улучшения observability. Код можно мержить после исправления [S1].
