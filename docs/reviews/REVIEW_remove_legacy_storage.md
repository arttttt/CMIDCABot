# Code Review: Remove Legacy In-Memory Storage

**Reviewed:**
- `src/infrastructure/shared/config/envSchema.ts`
- `src/infrastructure/shared/config/index.ts`
- `src/data/factories/RepositoryFactory.ts`
- `src/data/repositories/cache/index.ts`
- `src/index.ts`
- `.env.example`
- 7 удалённых InMemory репозиториев

**Date:** 2025-12-24
**Status:** 🟢 Approved

---

## Summary

Качественный рефакторинг, удаляющий ~560 строк legacy-кода. Все acceptance criteria выполнены: `DB_MODE` удалён, 7 legacy репозиториев удалены, директория переименована в `cache/`, build и lint проходят. Код стал проще и понятнее. Есть несколько minor improvements для будущих итераций.

---

## Findings

### 🔴 Critical (must fix before merge)

Нет критических проблем.

---

### 🟡 Should Fix (important but not blocking)

#### [S1] Несоответствие именования файлов и директории

**Location:** `src/data/repositories/cache/`
**Issue:** Директория переименована в `cache/`, но файлы внутри сохранили имена `InMemorySecretRepository.ts`, `InMemoryImportSessionRepository.ts`. Это создаёт когнитивный диссонанс: импорт выглядит как `from "./data/repositories/cache/InMemorySecretRepository"`.
**Impact:** Путаница при навигации и onboarding новых разработчиков.
**Suggestion:** Рассмотреть переименование в следующей итерации:
- `InMemorySecretRepository.ts` → `SecretCacheRepository.ts`
- `InMemoryImportSessionRepository.ts` → `ImportSessionCacheRepository.ts`

Или оставить директорию как `memory/` (out of scope текущей задачи).

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] Использование `import type` для Kysely

**Location:** `src/index.ts:9`
**Observation:** `Kysely` импортируется как value, но используется только для типизации `mockDb` (строка 112).
**Suggestion:**
```typescript
// Before
import { Kysely } from "kysely";

// After
import type { Kysely } from "kysely";
```

#### [N2] Проверка старых импортов

**Location:** Весь проект
**Observation:** Стоит убедиться, что нет других файлов с импортами из старого пути `repositories/memory/`.
**Suggestion:** Выполнить `grep -r "repositories/memory" src/` для проверки.

#### [N3] Документация ARCHITECTURE.md

**Location:** `prompts/ARCHITECTURE.md:17`
**Observation:** В структуре директорий указано `sources/memory/`, но теперь есть ещё `repositories/cache/`. Структура актуальна, но может быть полезно явно упомянуть `repositories/cache/` для кэширующих репозиториев.
**Suggestion:** Добавить комментарий в будущем при обновлении документации.

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Все AC выполнены, build/lint проходят |
| Architecture | ✅ | Clean Architecture соблюдена, layer access rules в норме |
| Security | ✅ | Нет изменений, влияющих на безопасность |
| Code Quality | ✅ | Удалён dead code, типизация сохранена |
| Conventions | ✅ | Trailing commas, English comments, existing patterns |

---

## Positive Highlights

1. **Значительное упрощение** — удалено ~560 строк кода и 7 файлов
2. **RepositoryFactory теперь минималистичен** — 56 строк вместо 89, нет ветвлений
3. **index.ts стал чище** — нет переменной `dbMode` и условной логики
4. **Сохранены легитимные кэши** — `SecretCache`, `ImportSessionCache`, `CachedBalanceRepository`
5. **Build и lint проходят** — изменения не ломают проект

---

## Action Items

- [ ] [N1] Опционально: заменить `import { Kysely }` на `import type { Kysely }` в index.ts
- [ ] [S1] Рассмотреть переименование файлов в cache/ в следующей итерации (low priority)
- [ ] [N2] Проверить отсутствие старых импортов из `repositories/memory/`

---

## Verdict

**🟢 Approved** — изменения готовы к merge. Найденные issues — minor improvements, не блокируют.
