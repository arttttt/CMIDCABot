# Code Review: Balance Pre-validation (REL-07)

**Reviewed:**
- `src/domain/models/SwapStep.ts`
- `src/domain/models/PurchaseStep.ts`
- `src/domain/usecases/ExecuteSwapUseCase.ts`
- `src/domain/usecases/ExecutePurchaseUseCase.ts`
- `src/presentation/formatters/ProgressFormatter.ts`

**Date:** 2025-01-13
**Status:** 🟢 Approved

---

## Summary

Реализация соответствует спецификации REL-07. Код чистый, следует архитектурным правилам, типизация корректна. Есть одно замечание уровня "Consider" про дублирование проверки баланса, но это by design для early-exit и не является проблемой.

---

## Findings

### 🔴 Critical (must fix before merge)

Нет критических замечаний.

---

### 🟡 Should Fix (important but not blocking)

Нет блокирующих замечаний.

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] Двойная проверка баланса в Purchase flow

**Location:** `ExecutePurchaseUseCase.ts:84-108` и `ExecuteSwapUseCase.ts:111-135`

**Observation:** При вызове `ExecutePurchaseUseCase.execute()` баланс проверяется дважды:
1. В `ExecutePurchaseUseCase` (строки 84-108) — early-exit
2. В `ExecuteSwapUseCase` (строки 111-135) — перед quote

Это by design — early-exit в Purchase предотвращает лишние API-вызовы (prices, allocations). Однако технически это два RPC-вызова (или два cache hit).

**Suggestion:** Можно рассмотреть передачу уже проверенного баланса в `ExecuteSwapUseCase`, но это усложнит API и нарушит инкапсуляцию. Текущая реализация с кэшем (`BalanceRepository`) минимизирует overhead — второй вызов будет cache hit.

**Verdict:** Оставить как есть. Кэш решает проблему производительности.

---

#### [N2] Дублирование кода проверки баланса

**Location:** `ExecutePurchaseUseCase.ts:87-95` и `ExecuteSwapUseCase.ts:114-122`

**Observation:** Код проверки баланса почти идентичен в обоих use case:
```typescript
let usdcBalance: number;
try {
  usdcBalance = await this.balanceRepository.getUsdcBalance(walletAddress);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  logger.error("...", "Failed to fetch USDC balance", { error: message });
  yield ...completed({ ... rpc_error ... });
  return;
}
```

**Suggestion:** Согласно ARCHITECTURE.md, вынесение в `utils/helpers` запрещено. Use cases должны быть самодостаточны. Текущее дублирование допустимо — это отдельные use cases с разной ответственностью.

**Verdict:** Оставить как есть. Дублирование минимально и оправдано архитектурой.

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Логика соответствует AC, edge cases обработаны |
| Architecture | ✅ | Clean Architecture соблюдена, слои корректны |
| Security | ✅ | Нет секретов, input validation присутствует |
| Code Quality | ✅ | Типы явные, нет `any`, SRP соблюдён |
| Conventions | ✅ | Trailing commas, комментарии на английском |

---

## Action Items

Нет обязательных action items. Код готов к merge.
