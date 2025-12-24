# Code Review: Zod-валидация переменных окружения (v2 — после исправлений)

**Reviewed:**
- `src/infrastructure/shared/config/envSchema.ts`
- `src/infrastructure/shared/config/AppConfig.ts`

**Date:** 2025-12-24
**Status:** 🟢 Approved

---

## Summary

После обработки замечаний предыдущего ревью код полностью соответствует acceptance criteria. Все валидации работают корректно, forbidden vars check перенесён в parseEnv(), дублирование устранено. Код готов к мержу.

---

## Findings

### 🔴 Critical (must fix before merge)

Нет критических проблем.

---

### 🟡 Should Fix (important but not blocking)

Нет проблем этой категории.

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] isDev вычисляется в двух местах внутри одного модуля

**Location:**
- `envSchema.ts:265-266` — для forbidden vars check
- `envSchema.ts:199` — для envToConfig

**Observation:** isDev вычисляется дважды, но теперь в одном модуле и с идентичной логикой. Первый используется ДО валидации схемы (forbidden vars), второй — ПОСЛЕ (трансформация).

**Assessment:** Это не проблема — две фазы обработки требуют одного значения в разных контекстах. Передача параметра усложнит код без пользы. Оставить как есть.

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Все валидации работают, ошибки выводятся корректно, условные проверки в superRefine |
| Architecture | ✅ | infrastructure/shared — корректное расположение, domain импортирует только типы |
| Security | ✅ | DEV_WALLET_PRIVATE_KEY очищается из process.env, forbidden vars блокируются в production |
| Code Quality | ✅ | Типы явные, комментарии поясняют архитектурные решения, код чистый |
| Conventions | ✅ | Trailing commas, комменты на английском, стиль соответствует проекту |

---

## Acceptance Criteria Verification

| Критерий | Статус |
|----------|--------|
| Добавлена зависимость `zod` | ✅ |
| Создан файл `envSchema.ts` с zod-схемой | ✅ |
| Все env variables валидируются при старте | ✅ |
| При невалидной конфигурации: показываются ВСЕ ошибки | ✅ |
| Типы `Config` определены с обоснованием | ✅ |
| `loadConfig()` использует схему | ✅ |
| Логика forbidden vars в production сохранена | ✅ |
| `.env.example` актуален | ✅ |

---

## Validation Rules Implemented

| Переменная | Реализовано |
|------------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ Required when WEB_ENABLED !== true (superRefine) |
| `OWNER_TELEGRAM_ID` | ✅ `.coerce.number().int().positive()` |
| `MASTER_ENCRYPTION_KEY` | ✅ `.regex(/^[A-Za-z0-9+/=]{43,44}$/)` |
| `PUBLIC_URL` | ✅ `.url()` |
| `WEBHOOK_URL` | ✅ `.url()` + HTTPS check in superRefine |
| `JUPITER_API_KEY` | ✅ Required when PRICE_SOURCE=jupiter (superRefine) |
| `DB_MODE` | ✅ `.enum(["sqlite", "memory"])` |
| `PRICE_SOURCE` | ✅ `.enum(["jupiter", "mock"])` |
| `BOT_TRANSPORT` | ✅ `.enum(["polling", "webhook"])` |
| `DCA_AMOUNT_USDC` | ✅ `.coerce.number().positive().min(1)` |
| `DCA_INTERVAL_MS` | ✅ `.coerce.number().int().positive()` |
| `SOLANA_RPC_URL` | ✅ `.url()` + HTTPS in production (superRefine) |
| `HTTP_PORT`, `WEB_PORT` | ✅ `.coerce.number().int().min(1).max(65535)` |

---

## Previous Findings Resolution

| ID | Finding | Resolution |
|----|---------|------------|
| S1 | Типы не выводятся из z.infer | ❌ REJECTED — envSchema (flat) ≠ Config (nested), добавлен комментарий |
| S2 | Дублирование isDev | ✅ FIXED — forbidden vars перенесён в parseEnv() |
| N1 | WEB_ENABLED упростить | ✅ FIXED — z.preprocess() |
| N2 | DCA_AMOUNT_USDC минимум | ✅ FIXED — .min(1) |
| N3 | MASTER_ENCRYPTION_KEY | ⏸️ DEFERRED — базовая проверка per PM decision |

---

## Action Items

Нет — код готов к мержу.
