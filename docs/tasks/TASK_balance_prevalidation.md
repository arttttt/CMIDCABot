# Task: Pre-validation баланса USDC перед покупкой (REL-07)

## Context

`ExecutePurchaseUseCase` делегирует проверку баланса в `ExecuteSwapUseCase`. Проверка происходит **после** выбора актива, что приводит к лишним API-вызовам (балансы, цены, расчёт allocations) при недостаточном балансе. Кроме того, в UI отсутствует визуальный шаг проверки баланса.

## Acceptance Criteria

- [ ] В `SwapStep` добавлен step `checking_balance`
- [ ] В `PurchaseStep` добавлен step `checking_balance`
- [ ] `ExecuteSwapUseCase` yield-ит `SwapSteps.checkingBalance()` перед проверкой баланса
- [ ] `ExecutePurchaseUseCase` выполняет early-exit при недостаточном балансе **до** выбора актива
- [ ] `ExecutePurchaseUseCase` yield-ит `PurchaseSteps.checkingBalance()` перед проверкой
- [ ] При недостаточном балансе возвращается `insufficient_balance` с `requiredBalance` и `availableBalance`

## Scope

- Добавление step `checking_balance` в оба Step-типа
- Pre-validation баланса в `ExecutePurchaseUseCase`
- Визуальный step в `ExecuteSwapUseCase` (логика проверки уже есть)

## Out of Scope

- Изменение UI/форматтеров (отдельная задача при необходимости)
- Изменение логики проверки баланса в `ExecuteSwapUseCase` (она уже корректна)
- Кэширование или оптимизация запросов баланса

## Technical Notes

### Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `src/domain/models/SwapStep.ts` | Добавить `checking_balance` в тип и helper |
| `src/domain/models/PurchaseStep.ts` | Добавить `checking_balance` в тип и helper |
| `src/domain/usecases/ExecuteSwapUseCase.ts` | Добавить yield step перед строкой 112 |
| `src/domain/usecases/ExecutePurchaseUseCase.ts` | Добавить pre-validation после получения wallet |

### Изменения в SwapStep.ts

```typescript
// В тип SwapStep добавить:
| { step: "checking_balance" }

// В SwapSteps добавить:
checkingBalance(): SwapStep {
  return { step: "checking_balance" };
},
```

### Изменения в PurchaseStep.ts

```typescript
// В тип PurchaseStep добавить:
| { step: "checking_balance" }

// В PurchaseSteps добавить:
checkingBalance(): PurchaseStep {
  return { step: "checking_balance" };
},
```

### Изменения в ExecuteSwapUseCase.ts

```typescript
// После строки 109 (if для no_wallet), перед строкой 111:
yield SwapSteps.checkingBalance();

// Существующая проверка баланса (строки 111-133) остаётся без изменений
```

### Изменения в ExecutePurchaseUseCase.ts

```typescript
// После строки 82 (return для no_wallet), добавить:

// Pre-validate USDC balance before asset selection (early-exit)
yield PurchaseSteps.checkingBalance();

let usdcBalance: number;
try {
  usdcBalance = await this.balanceRepository.getUsdcBalance(walletAddress);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  logger.error("ExecutePurchase", "Failed to fetch USDC balance", { error: message });
  yield PurchaseSteps.completed({ type: "rpc_error", error: message });
  return;
}

if (usdcBalance < amountUsdc) {
  logger.warn("ExecutePurchase", "Insufficient USDC balance", {
    required: amountUsdc,
    available: usdcBalance,
  });
  yield PurchaseSteps.completed({
    type: "insufficient_balance",
    requiredBalance: amountUsdc,
    availableBalance: usdcBalance,
  });
  return;
}
```

### Новый flow

**Purchase:**
```
checking_balance → selecting_asset → asset_selected → swap(...) → completed
```

**Swap:**
```
checking_balance → getting_quote → quote_received → building_transaction → sending_transaction → completed
```

### Зависимости

- `BalanceRepository` уже inject-ится в `ExecutePurchaseUseCase` (конструктор, строка 10)
- Метод `getUsdcBalance(walletAddress)` уже существует в `BalanceRepository`

## Open Questions

- Нет
