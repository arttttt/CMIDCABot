# Brief: Transaction Failure Detection

## Problem Statement

Бот показывает "Purchase Complete" + "Status: Pending" для транзакций, которые **упали на блокчейне**. Пользователь получает ложное подтверждение успеха.

**Реальный кейс:**
- Пользователь выполнил `/portfolio buy 10`
- Бот ответил "Purchase Complete", "Status: Pending"
- Транзакция на Solscan: `544hRpCDPRoajUsuWPMats4LCqZdK7ToqwYGzyybtMRTe3JHHQXzZ1CJ47YGhAQR8cx4UgH5vH2zU29ScGtWMsJN` — **failed**

## Proposed Solution

Различать три состояния транзакции после отправки:
1. **Confirmed** — транзакция подтверждена
2. **Pending** — ожидает подтверждения (timeout, но не ошибка)
3. **Failed** — транзакция упала с ошибкой на блокчейне

При `failed` показывать пользователю ошибку, а не успех.

## Technical Context

### Текущий flow

```
signAndSendTransaction()
  → sendTransaction()           // success: true (транзакция отправлена)
  → waitForConfirmation()       // возвращает boolean
      if (status.err !== null)
        return { status: "failure" }   // ← детектит ошибку
      ...
      return result.status === "success"  // ← но failure → false
  → confirmed: false            // pending и failed неразличимы!
```

### Проблемные файлы

| Файл | Проблема |
|------|----------|
| `src/data/sources/api/SolanaRpcClient.ts:894-923` | `waitForConfirmation` возвращает `boolean`, теряя информацию о failure |
| `src/data/sources/api/SolanaRpcClient.ts:750-755` | `confirmed: false` для обоих случаев (pending и failed) |
| `src/presentation/formatters/PurchaseFormatter.ts:61-76` | `type: "success"` + `confirmed: false` → "Purchase Complete" |

### Типы данных

**SendTransactionResult** (`src/data/repositories/BlockchainRepository.ts`):
```typescript
{
  success: boolean;
  signature: string | null;
  error: string | null;
  confirmed: boolean;  // ← нужно расширить
}
```

**SwapResult** (`src/domain/models/SwapStep.ts`):
```typescript
{
  status: "success";
  confirmed: boolean;  // ← нужно расширить
}
```

## Suggested Approach

1. **Изменить `waitForConfirmation`** — возвращать `"confirmed" | "pending" | "failed"`

2. **Обновить `SendTransactionResult`** — при `failed` возвращать `success: false` с ошибкой

3. **Use case flow** — при `failed` возвращать `type: "send_error"` (уже обрабатывается форматтером)

4. **Опционально:** сохранять в БД статус транзакции (confirmed/pending/failed) для истории

## Open Questions for PM

1. **Retry при failure?** — Показывать только ошибку или предлагать повторить?

2. **Pending-статус** — Сколько ждать подтверждения? Текущий timeout: 30 сек. Достаточно ли?

3. **Нотификации** — Если транзакция pending, нужно ли уведомлять позже при подтверждении/падении?

4. **История** — Сохранять ли failed-транзакции в БД?

## References

- `src/data/sources/api/SolanaRpcClient.ts` — signing и confirmation polling
- `src/domain/usecases/ExecuteSwapUseCase.ts` — swap execution
- `src/domain/usecases/ExecutePurchaseUseCase.ts` — purchase orchestration
- `src/presentation/formatters/PurchaseFormatter.ts` — UI formatting
- `src/domain/models/SwapStep.ts` — SwapResult type
