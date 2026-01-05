<!-- GitHub Issue: #221 -->
# Brief: Price Impact Limit

## Problem Statement

**Суть проблемы:** Параметр `priceImpactPct` парсится из Jupiter API, но нигде не валидируется перед выполнением транзакции.

**Критическое различие:**
- **Slippage** — цена изменилась между получением quote и execution (защищено 0.5% лимитом)
- **Price Impact** — ваш ордер двигает рыночную цену из-за недостаточной ликвидности (НЕ защищено)

**Почему это опасно для DCA-бота:**
- DCA предполагает регулярные покупки фиксированных сумм
- При низкой ликвидности каждая покупка может терять 2-10% на price impact
- Потери накапливаются со временем, разрушая эффективность DCA-стратегии
- Wrapped токены (cbBTC, wETH) особенно уязвимы из-за меньшей ликвидности

## Technical Context

### Flow от quote до execution

```
JupiterSwapClient.getQuote()           [строка 126-212]
  → parseFloat(data.priceImpactPct)    [строка 196]
  → JupiterSwapRepository.mapQuote()   [строка 73-90]
  → ExecuteSwapUseCase.execute()
    → swapRepository.getQuoteUsdcToAsset()  [строка 171]
    → SwapSteps.quoteReceived()        [строка 180-188]
    → buildSwapTransaction()           [строка 196] ← ПРОВЕРКА ОТСУТСТВУЕТ
    → signAndSendTransaction()         [строка 213-223]
```

**Проблема:** Между получением quote (строка 171) и buildSwapTransaction (строка 196) в `ExecuteSwapUseCase.ts` нет проверки `priceImpactPct`.

### Все места использования priceImpactPct

| Файл | Строки | Использование |
|------|--------|---------------|
| `src/data/sources/api/JupiterSwapClient.ts` | 43, 70, 196, 207 | Интерфейс + парсинг + логирование |
| `src/domain/repositories/SwapRepository.ts` | 33 | Domain интерфейс |
| `src/data/repositories/JupiterSwapRepository.ts` | 83 | Маппинг client → domain |
| `src/domain/models/SwapStep.ts` | 21 | QuoteInfo интерфейс |
| `src/domain/usecases/ExecuteSwapUseCase.ts` | 185 | Передача в SwapStep |
| `src/domain/usecases/GetQuoteUseCase.ts` | 78 | Логирование |
| `src/presentation/formatters/QuoteFormatter.ts` | 43 | UI отображение |
| `src/presentation/formatters/ProgressFormatter.ts` | 137 | UI отображение |

### Анализ SlippageCalculator

Файл: `src/domain/helpers/SlippageCalculator.ts`

```typescript
static calculateBps(originalQuote: SwapQuote, freshQuote: SwapQuote): number {
  const priceDiff =
    (freshQuote.outputAmount - originalQuote.outputAmount) /
    originalQuote.outputAmount;
  return Math.abs(priceDiff * 10000);
}
```

**Важно:** SlippageCalculator сравнивает два quote между собой (original vs fresh) для re-confirmation flow. Он НЕ проверяет `priceImpactPct` — это совсем другая метрика.

### Существующие паттерны валидации

**Константы в `src/domain/constants.ts`:**
```typescript
export const MIN_SOL_AMOUNT = 0.01;
export const MIN_USDC_AMOUNT = 0.01;
export const MAX_USDC_AMOUNT = 50;
```

**Валидация в UseCase:**
```typescript
// ExecuteSwapUseCase.ts, строки 64-86
if (amountUsdc < MIN_USDC_AMOUNT) {
  yield SwapSteps.completed({
    status: "invalid_amount",
    message: `Minimum amount is ${MIN_USDC_AMOUNT} USDC`,
  });
  return;
}
```

**Domain errors:** `src/domain/errors/UserNotFoundError.ts` — пример custom error

## Risk Analysis

### Slippage vs Price Impact — детальное сравнение

| Характеристика | Slippage | Price Impact |
|----------------|----------|--------------|
| Что измеряет | Изменение рыночной цены во времени | Влияние ордера на цену |
| Причина | Волатильность рынка | Недостаточная ликвидность |
| Когда возникает | Между quote и execution | В момент execution |
| Текущая защита | 0.5% (DEFAULT_SLIPPAGE_BPS = 50) | Отсутствует |
| Кто контролирует | Jupiter (dynamicSlippage) | Наш код должен проверять |

### Реальные сценарии потерь

| Актив | Сумма USDC | Ликвидность | Price Impact | Потеря USD |
|-------|------------|-------------|--------------|------------|
| SOL | $50 | Высокая | 0.1% | $0.05 |
| wETH | $50 | Средняя | 2-3% | $1.00-1.50 |
| cbBTC | $50 | Низкая | 5-10% | $2.50-5.00 |

### Worst-case сценарий

**Условия:**
- Актив: cbBTC (wrapped Bitcoin на Solana)
- Devnet с минимальной ликвидностью
- Сумма: $50 USDC

**Результат:**
- Price impact: 10-15%
- Потеря за транзакцию: $5-7.50
- При ежедневном DCA за месяц: $150-225 потерь

**Накопительный эффект:**
- 30 транзакций x $5 потерь = $150
- На $1500 инвестиций — 10% потерь только на price impact

## Suggested Approach

### Рекомендуемый вариант: Fail-fast валидация в UseCase

**Почему этот подход:**
- Соответствует существующему паттерну валидации (amount checks)
- Минимальные изменения
- Четкое разделение ответственности
- Легко тестировать

### Детальный план изменений

#### 1. `src/domain/constants.ts`

Добавить константу:
```typescript
/**
 * Maximum price impact allowed for swaps in basis points.
 * Transactions with higher price impact will be rejected.
 * 50 bps = 0.5%
 */
export const MAX_PRICE_IMPACT_BPS = 50;
```

#### 2. `src/domain/models/SwapStep.ts`

Добавить новый статус в `SwapResult`:
```typescript
export type SwapResult =
  | { status: "success"; ... }
  | { status: "high_price_impact"; priceImpactPct: number }  // NEW
  | { status: "unavailable" }
  // ... остальные статусы
```

#### 3. `src/domain/usecases/ExecuteSwapUseCase.ts`

После получения quote (после строки 177), добавить проверку:
```typescript
// Check price impact before building transaction
const priceImpactBps = quote.priceImpactPct * 100;
if (priceImpactBps > MAX_PRICE_IMPACT_BPS) {
  logger.warn("ExecuteSwap", "Price impact too high", {
    priceImpactPct: quote.priceImpactPct,
    maxAllowedPct: MAX_PRICE_IMPACT_BPS / 100,
  });
  yield SwapSteps.completed({
    status: "high_price_impact",
    priceImpactPct: quote.priceImpactPct,
  });
  return;
}
```

#### 4. `src/presentation/formatters/SwapFormatter.ts`

Добавить обработку нового статуса:
```typescript
case "high_price_impact":
  return new ClientResponse(
    `Price impact too high: ${result.priceImpactPct.toFixed(2)}%\n` +
    `Maximum allowed: 0.5%\n\n` +
    `This usually means low liquidity. Try a smaller amount.`
  );
```

#### 5. `src/domain/usecases/ExecutePurchaseUseCase.ts`

Добавить маппинг нового статуса в `mapSwapResultToPurchaseResult`:
```typescript
case "high_price_impact":
  return {
    type: "high_price_impact",
    priceImpactPct: swapResult.priceImpactPct
  };
```

### Альтернативные подходы (отклонены)

| Подход | Причина отклонения |
|--------|-------------------|
| Валидация в Repository | Смешивает data и business logic |
| Отдельный PriceImpactValidator | Избыточно для одной проверки |
| Warning + confirmation | Усложняет UX, не соответствует требованиям PM |

## PM Decisions

| Вопрос | Решение | Обоснование |
|--------|---------|-------------|
| Лимит price impact | 50 bps (0.5%) | Соответствует slippage лимиту |
| Per-asset лимиты | Нет, единый для всех | Простота, унификация |
| Поведение при превышении | Hard fail | Защита пользователя |
| Логирование без блокировки | Нет | Избыточно |
| Route complexity | Общий лимит покрывает | Упрощение |

## References

- `/Users/artem/.claude-worktrees/DCATgBot/romantic-hellman/src/data/sources/api/JupiterSwapClient.ts` — Jupiter API клиент
- `/Users/artem/.claude-worktrees/DCATgBot/romantic-hellman/src/domain/usecases/ExecuteSwapUseCase.ts` — основной UseCase для изменений
- `/Users/artem/.claude-worktrees/DCATgBot/romantic-hellman/src/domain/helpers/SlippageCalculator.ts` — пример паттерна (для справки)
- `/Users/artem/.claude-worktrees/DCATgBot/romantic-hellman/src/domain/constants.ts` — место для новой константы
- `/Users/artem/.claude-worktrees/DCATgBot/romantic-hellman/src/domain/models/SwapStep.ts` — типы для расширения
