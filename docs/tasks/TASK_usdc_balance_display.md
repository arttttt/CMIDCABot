# Task: Добавить вывод USDC баланса + увеличить TTL кеша

## Context

USDC баланс уже кешируется в `CachedBalanceRepository`, но не отображается пользователю. Для DCA-бота критично видеть USDC — это средства для покупки активов. Текущий TTL кеша (10 сек) избыточно короткий для UI-операций.

## Acceptance Criteria

- [ ] `/wallet` показывает USDC баланс рядом с SOL
- [ ] Формат: `SOL Balance: X.XXXX SOL` + `USDC Balance: X.XX USDC`
- [ ] Использует существующий кеш (`CachedBalanceRepository`)
- [ ] Работает при нулевом балансе USDC
- [ ] TTL кеша баланса = 60 секунд

## Scope

- Расширить `DcaWalletInfo` полем `usdcBalance`
- Обновить `WalletInfoHelper` — получать USDC из `BalanceRepository`
- Обновить форматтер — выводить USDC
- Изменить `DEFAULT_CACHE_TTL_MS` с 10_000 на 60_000

## Out of Scope

- Вывод BTC/ETH балансов (это `/portfolio`)
- Изменение логики инвалидации кеша
- Новые RPC вызовы

## Technical Notes

- `BalanceRepository.getBalances()` уже возвращает `{ sol, btc, eth, usdc }`
- Инвалидация после транзакций остаётся — свежие данные после покупки
- Затронутые файлы:
  - `src/data/repositories/memory/CachedBalanceRepository.ts` — TTL
  - `src/domain/usecases/types.ts` — `DcaWalletInfo`
  - `src/domain/helpers/WalletInfoHelper.ts` — получение USDC
  - `src/presentation/formatters/DcaWalletFormatter.ts` — вывод

## Open Questions

- Нет
