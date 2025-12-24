# Code Review: Transaction Failure Detection

**Reviewed:**
- `src/data/sources/api/SolanaRpcClient.ts`
- `src/domain/models/SwapStep.ts`
- `src/domain/usecases/ExecuteSwapUseCase.ts`
- `src/domain/usecases/ExecutePurchaseUseCase.ts`
- `src/presentation/formatters/PurchaseFormatter.ts`

**Date:** 2025-12-24
**Status:** 🟢 Approved (all items fixed)

---

## Summary

Реализация корректно решает проблему — теперь failed-транзакции определяются и показываются пользователю как ошибка. Архитектура соблюдена: изменения в data layer не затрагивают domain напрямую, типы пробрасываются через интерфейсы. Код чистый, без явных багов.

---

## Findings

### 🟡 Should Fix (important but not blocking)

#### [S1] Статус "pending" после таймаута вводит в заблуждение

**Location:** `src/data/sources/api/SolanaRpcClient.ts:36` и логика в `waitForConfirmation`
**Issue:** При таймауте (30 сек без ответа) возвращается статус `"pending"`. Но "pending" подразумевает, что мы ещё ждём подтверждения. На самом деле мы уже прекратили ожидание — статус транзакции неизвестен.
**Impact:** Пользователь видит "Status: Pending" и думает, что транзакция обрабатывается. На самом деле она могла уже упасть или быть дропнута из mempool.
**Suggestion:** Переименовать `"pending"` → `"timeout"` в `ConfirmationStatus`. Обновить UI: показывать "Confirmation timeout — check explorer" вместо "Pending".

```typescript
// Before
export type ConfirmationStatus = "confirmed" | "pending" | "failed";

// After
export type ConfirmationStatus = "confirmed" | "timeout" | "failed";
```

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] Дублирование логики обработки confirmationStatus

**Location:** `src/data/sources/api/SolanaRpcClient.ts:743-777` и `870-904`
**Observation:** Идентичная логика if/else if/else в `signAndSendTransaction` и `signAndSendTransactionSecure`.
**Suggestion:** Можно вынести в приватный метод `handleConfirmationResult(confirmationStatus, signature, confirmDuration)`. Не критично — код читаем и понятен.

---

#### [N2] Тип ConfirmationStatus экспортируется, но не используется вне файла

**Location:** `src/data/sources/api/SolanaRpcClient.ts:36`
**Observation:** `export type ConfirmationStatus` экспортируется, но используется только внутри класса.
**Suggestion:** Можно убрать `export` если тип не планируется использовать извне. Не влияет на работу.

---

#### [N3] Проверка `signature ?? undefined` избыточна

**Location:** `src/domain/usecases/ExecuteSwapUseCase.ts:209`
**Observation:** `signature: sendResult.signature ?? undefined` — если `sendResult.signature` это `string | null`, то `null ?? undefined` вернёт `undefined`. Работает корректно, но выглядит избыточно.
**Suggestion:** Можно использовать `signature: sendResult.signature || undefined` или оставить как есть — поведение корректное.

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Логика соответствует acceptance criteria. Три состояния (confirmed/pending/failed) корректно обрабатываются |
| Architecture | ✅ | Clean Architecture соблюдена. Data layer не зависит от domain. Use cases возвращают domain objects |
| Security | ✅ | Signature не содержит sensitive data. Error messages санитизируются (LOW-003) |
| Code Quality | ✅ | Типы явные, no `any`. Single responsibility соблюдён. Имена понятные |
| Conventions | ✅ | Trailing commas, комментарии на английском. Соответствует существующим паттернам |

---

## Architecture Compliance

### Layer Access Rules — ✅ Соблюдены

```
data (SolanaRpcClient)
  → infrastructure/shared (logger)
  → domain/repositories (SendTransactionResult interface)

domain (ExecuteSwapUseCase, ExecutePurchaseUseCase)
  → domain/models (SwapStep, SwapResult)
  → domain/repositories (BlockchainRepository interface)
  → infrastructure/shared (logger)

presentation (PurchaseFormatter)
  → domain/usecases/types (PurchaseResult)
  → presentation/protocol (UIResponse)
```

### Anti-patterns — ✅ Не нарушены

- ❌ Utils/helpers/common — не создавались
- ❌ Business logic in data layer — data layer только возвращает статус
- ❌ Business logic in formatters — форматтер только форматирует
- ❌ Framework deps in domain — domain чист

### Naming Conventions — ✅ Соблюдены

- `ConfirmationStatus` — тип состояния, корректное имя
- `SolanaRpcClient` — API client с суффиксом `*Client`

---

## Action Items

- [x] [S1] Переименовать `"pending"` → `"timeout"` и обновить UI-сообщение
- [x] [N1] Вынести дублирующуюся логику в приватный метод `buildConfirmationResult`
- [x] [N2] Убрать export у ConfirmationStatus
- [x] [N3] Исправить избыточную проверку `signature ?? undefined` → `signature || undefined`

---

## Verdict

**🟢 Approved** — все замечания исправлены.
