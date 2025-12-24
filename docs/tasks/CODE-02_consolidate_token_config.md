# Task: CODE-02 — Консолидация конфигурации токенов

## Context

Token mints и decimals дублируются в трёх файлах:
- `src/data/sources/api/JupiterPriceClient.ts` — `TOKEN_MINTS`
- `src/data/sources/api/JupiterSwapClient.ts` — `TOKEN_DECIMALS`
- `src/data/repositories/memory/CachedBalanceRepository.ts` — `TOKEN_CONFIGS`

При добавлении нового актива или изменении адреса нужно редактировать несколько файлов, что создаёт риск рассинхронизации.

## Acceptance Criteria

- [ ] Создан единый конфигурационный файл `src/infrastructure/shared/config/tokens.ts`
- [ ] Все данные о токенах (mint, decimals) определены в одном месте
- [ ] Обратная совместимость: `TOKEN_MINTS` и `TOKEN_DECIMALS` экспортируются для существующего кода
- [ ] Удалены дублирующиеся определения из JupiterPriceClient и JupiterSwapClient
- [ ] CachedBalanceRepository использует новый конфиг напрямую
- [ ] Все существующие импорты обновлены
- [ ] Проект компилируется без ошибок (`npm run build`)
- [ ] Существующие тесты проходят (`npm test`)

## Scope

- Создание нового файла конфигурации токенов
- Рефакторинг импортов в затронутых файлах
- Удаление дублирующегося кода

## Out of Scope

- Добавление новых токенов
- Изменение логики работы с токенами
- Изменение API классов (JupiterPriceClient, JupiterSwapClient, CachedBalanceRepository)

## Technical Notes

### Расположение нового файла

```
src/infrastructure/shared/config/tokens.ts
```

Согласно архитектуре (`prompts/ARCHITECTURE.md`), `infrastructure/shared/` доступен всем слоям.

### Структура нового файла

```typescript
/**
 * Centralized token configuration
 * Single source of truth for all token-related constants
 */

export interface TokenConfig {
  mint: string;
  decimals: number;
}

/**
 * Token configurations for supported assets
 *
 * IMPORTANT: SOL uses WSOL (Wrapped SOL) mint address for DEX/price APIs.
 * Jupiter handles wrap/unwrap automatically via wrapAndUnwrapSol=true.
 * See JupiterPriceClient.ts for detailed explanation.
 */
export const TOKENS: Record<string, TokenConfig> = {
  SOL: {
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
  },
  USDC: {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
  },
  BTC: {
    mint: "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij",
    decimals: 8,
  },
  ETH: {
    mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    decimals: 8,
  },
} as const;

/**
 * Backward-compatible exports
 * TODO: Consider deprecating these in favor of TOKENS directly
 */
export const TOKEN_MINTS = {
  SOL: TOKENS.SOL.mint,
  USDC: TOKENS.USDC.mint,
  BTC: TOKENS.BTC.mint,
  ETH: TOKENS.ETH.mint,
} as const;

export const TOKEN_DECIMALS = {
  SOL: TOKENS.SOL.decimals,
  USDC: TOKENS.USDC.decimals,
  BTC: TOKENS.BTC.decimals,
  ETH: TOKENS.ETH.decimals,
} as const;
```

### Файлы для обновления

| Файл | Изменения |
|------|-----------|
| `src/infrastructure/shared/config/tokens.ts` | Создать (новый) |
| `src/infrastructure/shared/config/index.ts` | Добавить реэкспорт |
| `src/data/sources/api/JupiterPriceClient.ts` | Удалить `TOKEN_MINTS`, обновить импорт |
| `src/data/sources/api/JupiterSwapClient.ts` | Удалить `TOKEN_DECIMALS`, обновить импорт |
| `src/data/repositories/memory/CachedBalanceRepository.ts` | Удалить `TOKEN_CONFIGS`, использовать `TOKENS` |

### Порядок выполнения

1. Создать `tokens.ts` с полной конфигурацией
2. Обновить `index.ts` в config (добавить экспорт)
3. Обновить JupiterPriceClient — заменить локальный `TOKEN_MINTS` на импорт
4. Обновить JupiterSwapClient — заменить локальный `TOKEN_DECIMALS` на импорт
5. Обновить CachedBalanceRepository — использовать `TOKENS` напрямую
6. Запустить `npm run build` — убедиться, что компилируется
7. Запустить `npm test` — убедиться, что тесты проходят

## Open Questions

Нет открытых вопросов — задача чисто техническая.
