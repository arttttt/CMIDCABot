# Code Review: CleanupScheduler Async Refactoring (REL-04)

**Reviewed:**
- `src/infrastructure/shared/scheduling/CleanupScheduler.ts`
- `src/data/sources/memory/SecretCache.ts`
- `src/data/sources/memory/ImportSessionCache.ts`

**Date:** 2025-12-24
**Status:** 🟡 Approved with comments

---

## Summary

Изменения корректно решают проблему REL-04 — теперь stores очищаются независимо друг от друга через `Promise.allSettled`. Однако rejected promises полностью игнорируются, что может затруднить диагностику проблем в production.

---

## Findings

### 🔴 Critical (must fix before merge)

*Нет критических проблем*

---

### 🟡 Should Fix (important but not blocking)

#### [S1] Rejected promises не логируются

**Location:** `src/infrastructure/shared/scheduling/CleanupScheduler.ts:31-32`
**Issue:** Результат `Promise.allSettled` игнорируется с `void`. Если какой-то store выбросит исключение (например, DB connection lost), ошибка потеряется без следа в логах.
**Impact:** Затруднённая диагностика — проблемы с очисткой могут долго оставаться незамеченными.
**Suggestion:**
```typescript
this.timer = setInterval(async () => {
  const results = await Promise.allSettled(
    this.stores.map((store) => store.deleteExpired()),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      logger.error("CleanupScheduler", "Store cleanup failed", {
        error: result.reason,
      });
    }
  }
}, this.intervalMs);
```

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] async без await в deleteExpired кэшей

**Location:**
- `src/data/sources/memory/SecretCache.ts:129`
- `src/data/sources/memory/ImportSessionCache.ts:201`

**Observation:** Методы объявлены как `async`, но внутри нет `await`. Это работает корректно (возвращает resolved Promise), но создаёт ложное ожидание асинхронных операций.
**Suggestion:** Оставить как есть — это подготовка к возможной будущей асинхронности (например, если кэши станут использовать Redis). Добавить комментарий для ясности:
```typescript
// Note: async for interface compatibility, currently sync
async deleteExpired(): Promise<number> {
```

#### [N2] Отсутствует логирование количества очищенных записей в scheduler

**Location:** `src/infrastructure/shared/scheduling/CleanupScheduler.ts:31-32`
**Observation:** Scheduler не логирует общее количество очищенных записей. Каждый store логирует отдельно, но нет сводной информации.
**Suggestion:** Опционально добавить debug-лог с агрегированным результатом:
```typescript
const total = results
  .filter((r) => r.status === "fulfilled")
  .reduce((sum, r) => sum + r.value, 0);
if (total > 0) {
  logger.debug("CleanupScheduler", "Cleanup complete", { total });
}
```

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Логика работает, stores очищаются независимо |
| Architecture | ✅ | Соответствует Clean Architecture, правильное расположение файлов |
| Security | ✅ | Нет проблем |
| Code Quality | ⚠️ | Отсутствует обработка rejected promises |
| Conventions | ✅ | Trailing commas, комментарии на английском |

---

## Action Items

- [ ] [S1] Добавить логирование rejected promises в CleanupScheduler
- [ ] [N1] Опционально: добавить комментарий о причине async в кэшах
