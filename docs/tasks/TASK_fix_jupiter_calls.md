<!-- GitHub Issue: #205 -->
# Task: Fix Jupiter Price API URL Formation

## Context
Команда `/portfolio` возвращает "Failed to fetch portfolio" из-за некорректного формирования URL для Jupiter Price API. В `JupiterPriceClient.ts:58` объекты `TokenMint` передаются в `join()` без преобразования в строки, что приводит к URL вида `?ids=[object Object],[object Object],[object Object]`.

## Acceptance Criteria
- [x] URL запроса к Jupiter Price API содержит корректные mint-адреса токенов
- [x] Команда `/portfolio` успешно возвращает данные портфеля
- [x] Используется паттерн `.value` для получения строкового значения из `TokenMint`

## Scope
- Исправление формирования массива mint-адресов в `JupiterPriceClient.ts:58`
- Замена `[TOKEN_MINTS.BTC, TOKEN_MINTS.ETH, TOKEN_MINTS.SOL]` на `[TOKEN_MINTS.BTC.value, TOKEN_MINTS.ETH.value, TOKEN_MINTS.SOL.value]`

## Out of Scope
- Добавление `toString()` метода в класс `TokenMint`
- Интеграционные или unit-тесты
- Изменения в других файлах

## Technical Notes
- Файл: `src/data/sources/api/JupiterPriceClient.ts`, строка 58
- Паттерн `.value` уже используется в `JupiterSwapClient.ts` — следовать этому примеру
- После исправления URL должен выглядеть: `?ids=<btc_mint>,<eth_mint>,<sol_mint>`
