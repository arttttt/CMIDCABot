# Task: Transaction Failure Detection

## Context

Бот показывает "Purchase Complete" для транзакций, которые упали на блокчейне. Пользователь получает ложное подтверждение успеха. Нужно корректно определять failed-транзакции и показывать ошибку.

## Acceptance Criteria

- [ ] При падении транзакции на блокчейне (`status.err !== null`) пользователь видит сообщение об ошибке, а не "Purchase Complete"
- [ ] Сообщение об ошибке содержит ссылку на Solscan для диагностики
- [ ] Pending-статус показывается только при timeout (транзакция не подтверждена, но и не упала)
- [ ] Логи содержат информацию о причине падения транзакции

## Scope

- Изменить `waitForConfirmation` — возвращать три состояния: `confirmed | pending | failed`
- Обновить `SendTransactionResult` — при `failed` возвращать `success: false`
- Пробросить ошибку через use case как `type: "send_error"`
- Форматтер уже обрабатывает `send_error` — убедиться, что показывает ссылку на транзакцию

## Out of Scope

- Сохранение failed-транзакций в БД
- Кнопка "Повторить" при ошибке
- Фоновые уведомления о статусе pending-транзакций
- Изменение timeout (остаётся 30 сек)

## Technical Notes

**Файлы для изменения:**

| Файл | Изменение |
|------|-----------|
| `src/data/sources/api/SolanaRpcClient.ts` | `waitForConfirmation` возвращает `"confirmed" \| "pending" \| "failed"` |
| `src/data/sources/api/SolanaRpcClient.ts` | `signAndSendTransaction` при `failed` возвращает `success: false, error: "Transaction failed on-chain"` |
| `src/domain/repositories/BlockchainRepository.ts` | Проверить тип `SendTransactionResult` (возможно, изменений не нужно) |
| `src/presentation/formatters/PurchaseFormatter.ts` | Убедиться, что `send_error` показывает signature для ссылки на explorer |

**Ключевое изменение в `waitForConfirmation`:**

```
Было:  return boolean (true = confirmed, false = pending OR failed)
Стало: return "confirmed" | "pending" | "failed"
```

**Flow при failed:**
```
waitForConfirmation() returns "failed"
  → signAndSendTransaction() returns { success: false, error: "...", signature }
  → ExecuteSwapUseCase yields { status: "error", error: "..." }
  → PurchaseFormatter показывает "Transaction failed" + ссылка
```

## Open Questions

- Нет
