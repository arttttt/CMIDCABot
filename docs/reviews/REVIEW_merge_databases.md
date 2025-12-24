# Code Review: Merge MainDB and MockDB for Atomic Delete Operations

**Reviewed:**
- `src/data/types/database.ts`
- `src/data/sources/database/KyselyDatabase.ts`
- `src/data/sources/database/index.ts`
- `src/data/repositories/sqlite/SQLitePortfolioRepository.ts`
- `src/data/repositories/sqlite/SQLitePurchaseRepository.ts`
- `src/data/repositories/sqlite/SQLiteSchedulerRepository.ts`
- `src/data/factories/RepositoryFactory.ts`
- `src/infrastructure/shared/config/envSchema.ts`
- `src/index.ts`
- `src/domain/usecases/DeleteUserDataUseCase.ts`
- `.env.example`

**Date:** 2025-12-24
**Status:** 🟡 Approved with comments

---

## Summary

Задача по слиянию баз данных выполнена корректно. DELETE операции теперь выполняются в рамках единой SQLite транзакции, что решает проблему [REL-03]. Однако есть архитектурное нарушение: Domain layer (UseCase) теперь импортирует Kysely напрямую. Это было осознанным компромиссом для поддержки транзакций, но нуждается в документировании.

---

## Findings

### 🟡 Should Fix (important but not blocking)

#### [S1] Архитектурное нарушение: Domain импортирует Kysely
**Location:** `src/domain/usecases/DeleteUserDataUseCase.ts:14,21,30`
**Issue:** Domain layer напрямую импортирует `Kysely` из библиотеки и `MainDatabase` из data layer. Это нарушает принцип Clean Architecture — Domain не должен зависеть от конкретных ORM или data layer.
**Impact:** Затрудняет тестирование UseCase в изоляции, создаёт связанность с конкретной реализацией.
**Suggestion:**
Документировать это как осознанный компромисс в `prompts/ARCHITECTURE.md`:
```markdown
## Исключения

### DeleteUserDataUseCase
UseCase напрямую использует Kysely для обеспечения атомарности DELETE операций.
Это осознанный компромисс: без доступа к транзакции невозможно гарантировать
консистентность данных при удалении пользователя.
```

---

#### [S2] Устаревший комментарий в типах
**Location:** `src/data/types/database.ts:43-44`
**Issue:** Комментарий `/** Portfolio table (mock/development) */` устарел после слияния БД — теперь это основная таблица.
**Suggestion:**
```typescript
// Before
/** Portfolio table (mock/development) */

// After
/** Portfolio table */
```

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] Отсутствие FOREIGN KEY для portfolio и purchases
**Location:** `src/data/sources/database/KyselyDatabase.ts:64-86`
**Issue:** Таблицы `portfolio` и `purchases` не имеют FOREIGN KEY на `users(telegram_id)`, в отличие от `transactions` (строка 55).
**Observation:** Это не баг — каскадное удаление не нужно, т.к. DeleteUserDataUseCase удаляет всё явно в транзакции. Но FK обеспечит целостность данных на уровне БД.
**Suggestion:**
```sql
-- portfolio
FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)

-- purchases
FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
```

---

#### [N2] Scheduler state не привязан к пользователю
**Location:** `src/data/sources/database/KyselyDatabase.ts:93-100`
**Issue:** Таблица `scheduler_state` — глобальная (id = 1), она логически не должна удаляться при удалении пользователя.
**Observation:** Это корректно — scheduler глобальный. Но это означает, что DeleteUserDataUseCase не трогает эту таблицу, что правильно.

---

#### [N3] Можно упростить условие в RepositoryFactory
**Location:** `src/data/factories/RepositoryFactory.ts:44-56`
**Issue:** Early return для memory mode, затем проверка `!db`. Можно сделать exhaustive switch.
**Suggestion:** Текущий код читаем, изменение опционально.

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Транзакция корректно оборачивает все DELETE |
| Architecture | ⚠️ | Domain → Kysely (осознанный компромисс) |
| Security | ✅ | Нет новых уязвимостей |
| Code Quality | ✅ | Типы явные, naming соответствует конвенциям |
| Conventions | ✅ | Trailing commas, комментарии на английском |

---

## Positive Observations

1. **Атомарность достигнута** — все DELETE операции в единой транзакции
2. **InMemory fallback** — корректно обрабатывается режим без транзакций
3. **Unified Repositories interface** — упрощает инициализацию в index.ts
4. **Удалён MOCK_DATABASE_PATH** — конфигурация стала чище
5. **Порядок удаления корректный** — зависимые таблицы удаляются первыми

---

## Action Items

- [ ] [S1] Добавить документацию об архитектурном исключении в ARCHITECTURE.md
- [ ] [S2] Обновить комментарий для PortfolioTable (убрать "mock/development")
- [ ] [N1] (опционально) Добавить FOREIGN KEY для portfolio и purchases

---

## Verdict

**🟡 Approved with comments**

Основная цель достигнута: DELETE операции теперь атомарны. Архитектурный компромисс (Domain → Kysely) приемлем для данного use case, но требует документирования. Рекомендуется исправить устаревший комментарий.
