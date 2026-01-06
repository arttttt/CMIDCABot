<!-- GitHub Issue: #224 -->
# Task: Parallel Operations Lock

## Context

Rate limit защищает от спама (30 запросов/мин), но не предотвращает параллельное выполнение транзакций одним пользователем. Два быстрых `/swap execute` могут выполниться одновременно, прочитав устаревший баланс из кэша до его инвалидации. Это создает риск double spend. Решение — блокировка на уровне repository, прозрачная для верхних слоев.

## Acceptance Criteria

- [x] Создан `OperationLockCache` в `src/data/sources/memory/OperationLockCache.ts`
- [x] `OperationLockCache` реализует методы `tryAcquire(userId): boolean` и `release(userId): void`
- [x] TTL блокировки составляет 60 секунд (автоматическое освобождение зависших locks)
- [x] `OperationLockCache` регистрируется в общем `cleanupScheduler` для периодической очистки
- [x] Интерфейс `BlockchainRepository` расширен: методы `signAndSendTransaction` и `signAndSendTransactionSecure` принимают `userId` как параметр
- [x] `SolanaBlockchainRepository` реализует acquire/release вокруг транзакций (acquire перед началом, release в finally)
- [x] При конфликте блокировки выбрасывается специфическая ошибка с текстом "Operation in progress. Please wait for the current transaction to complete."
- [x] Ошибка блокировки всплывает как обычная ошибка транзакции (use cases и presentation не требуют изменений)

## Scope

- `OperationLockCache` — in-memory storage с TTL и интеграцией в `cleanupScheduler`
- Расширение интерфейса `BlockchainRepository` (добавление userId в сигнатуры)
- Модификация `SolanaBlockchainRepository` — внедрение lock-логики
- Новый тип ошибки для конфликта блокировки

## Out of Scope

- Изменения в use cases (`ExecuteSwapUseCase`, `ExecutePurchaseUseCase`)
- Изменения в presentation layer (handlers, formatters)
- Собственный scheduler/dispose в `OperationLockCache` (используется общий `cleanupScheduler`)
- Персистентность блокировок (только in-memory)

## Technical Notes

- Паттерн аналогичен существующему `RateLimitCache` (`src/data/sources/memory/RateLimitCache.ts`)
- Lock хранит `Map<userId, timestamp>` для отслеживания активных операций
- `tryAcquire` возвращает `false` если lock уже занят и не истек TTL
- `release` удаляет запись из Map
- Периодическая очистка через `cleanupScheduler` удаляет записи старше TTL
- Изменение сигнатуры `signAndSendTransaction` требует обновления всех вызовов в use cases (передача userId)
