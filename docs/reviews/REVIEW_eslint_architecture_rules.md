# Code Review: ESLint Architecture Rules + Boundary Fixes

**Reviewed:** Task 10 — ESLint configuration + architectural boundary fixes
**Date:** 2025-12-23
**Status:** 🟢 Approved

---

## Summary

Задача выполнена корректно. ESLint с `eslint-plugin-boundaries` настроен правильно, архитектурные нарушения исправлены через создание proper repository layer. Код компилируется, lint проходит без ошибок.

---

## Findings

### 🔴 Critical (must fix before merge)

Нет критических проблем.

---

### 🟡 Should Fix (important but not blocking)

#### [S1] Конкретный тип вместо интерфейса в index.ts

**Location:** `src/index.ts:318`
**Issue:** Функция `createRegistryAndHandler` принимает конкретный тип `InMemoryImportSessionRepository` вместо интерфейса `ImportSessionRepository`.
**Impact:** Нарушает принцип инверсии зависимостей — функция зависит от конкретной реализации.
**Suggestion:**
```typescript
// Before
function createRegistryAndHandler(withImportSession: InMemoryImportSessionRepository, botUsername?: string)

// After
function createRegistryAndHandler(withImportSession: ImportSessionRepository, botUsername?: string)
```

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] Отсутствует правило для types layer

**Location:** `eslint.config.mjs:40-72`
**Observation:** Нет явного правила `from: 'types'` — types может импортировать только себя и ничего больше (по умолчанию `disallow`). Это корректно, но не документировано явно.
**Suggestion:** Добавить явное правило для ясности:
```javascript
{
  from: 'types',
  allow: ['types'],
},
```

#### [N2] Нет правила для entry point (src/index.ts)

**Location:** `eslint.config.mjs`
**Observation:** `src/index.ts` не попадает ни под один element type. Сейчас это работает благодаря `boundaries/no-unknown: 'error'` отсутствующему для файлов вне patterns, но может вызвать путаницу.
**Suggestion:** Добавить element type `entry` для root файлов или игнорировать их:
```javascript
{ type: 'entry', pattern: 'src/index.ts', mode: 'file' },
// И правило:
{ from: 'entry', allow: ['domain', 'data', 'presentation', 'infra-shared', 'infra-internal', 'types', 'wip'] },
```

#### [N3] Временное разрешение domain → wip

**Location:** `eslint.config.mjs:42-45`
**Observation:** Комментарий указывает что это временное решение, но нет TODO или issue для отслеживания.
**Suggestion:** Добавить TODO с описанием когда убрать:
```javascript
// TODO: Remove 'wip' from allow list after DcaScheduler migration (Task X)
```

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | ESLint работает, все правила применяются корректно |
| Architecture | ✅ | Proper layer separation: domain interfaces → data repositories → data sources |
| Security | ✅ | Нет изменений влияющих на безопасность |
| Code Quality | ⚠️ | [S1] Конкретный тип вместо интерфейса |
| Conventions | ✅ | Trailing commas, English comments, follows patterns |

---

## Acceptance Criteria Check

| Критерий | Статус |
|----------|--------|
| Установлен ESLint с `eslint-plugin-boundaries` | ✅ |
| Настроены правила для TypeScript | ✅ |
| Настроены правила проверки импортов между слоями | ✅ |
| Domain layer не может импортировать из data/presentation/services | ✅ (кроме wip) |
| Data layer не может импортировать из presentation | ✅ |
| infrastructure/internal доступен только для data layer | ✅ |
| Все правила в режиме `error` | ✅ |
| Добавлен npm script `lint` | ✅ |

---

## Action Items

- [ ] [S1] Заменить `InMemoryImportSessionRepository` на `ImportSessionRepository` в `index.ts:318`
- [ ] [N3] Добавить TODO для отслеживания удаления wip из разрешённых для domain
