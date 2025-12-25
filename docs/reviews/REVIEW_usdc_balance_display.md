# Code Review: USDC Balance Display + Cache TTL

**Reviewed:**
- `src/data/repositories/memory/CachedBalanceRepository.ts`
- `src/domain/usecases/types.ts`
- `src/domain/helpers/WalletInfoHelper.ts`
- `src/presentation/formatters/DcaWalletFormatter.ts`
- `src/index.ts`

**Date:** 2025-12-25
**Status:** 🟢 Approved

---

## Summary

Реализация корректна и соответствует спецификации. USDC баланс выводится рядом с SOL, TTL кеша увеличен до 60 секунд. Архитектурные правила соблюдены — domain использует только интерфейсы репозиториев. Код чистый, типизированный, без security-проблем.

---

## Findings

### 🔴 Critical (must fix before merge)

Нет критических проблем.

---

### 🟡 Should Fix (important but not blocking)

Нет проблем уровня Should Fix.

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] Дублирование логики получения балансов

**Location:** `src/domain/helpers/WalletInfoHelper.ts:28-36` и `:46-54`
**Observation:** Методы `getWalletInfo` и `getWalletInfoByAddress` содержат идентичный код получения балансов.
**Suggestion:** Выделить в приватный метод:
```typescript
private async fetchBalances(address: string): Promise<{ balance: number | null; usdcBalance: number | null }> {
  try {
    const balances = await this.balanceRepository.getBalances(address);
    return { balance: balances.sol, usdcBalance: balances.usdc };
  } catch {
    return { balance: null, usdcBalance: null };
  }
}
```

---

#### [N2] BlockchainRepository используется минимально

**Location:** `src/domain/helpers/WalletInfoHelper.ts:12`
**Observation:** После рефакторинга `blockchainRepository` используется только для `getAddressFromPrivateKey()`. Остальные методы получения баланса теперь через `balanceRepository`.
**Suggestion:** Это нормально — разные репозитории для разных задач. Но если в будущем `getAddressFromPrivateKey` перенесётся в другой сервис, зависимость от `BlockchainRepository` можно будет убрать.

---

#### [N3] Существующее архитектурное нарушение: domain/helpers

**Location:** `src/domain/helpers/WalletInfoHelper.ts`
**Observation:** Директория `domain/helpers` противоречит Anti-patterns в ARCHITECTURE.md ("Utils/helpers/common — Become dumps"). Это существующий код, не введённый данным изменением.
**Suggestion:** Рассмотреть перенос `WalletInfoHelper` в use cases или выделение в отдельный domain service в будущем рефакторинге. Не блокирует текущий PR.

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Логика верна, edge cases обработаны (null балансы) |
| Architecture | ✅ | Domain использует только интерфейсы, DI корректен |
| Security | ✅ | Нет secrets, балансы не логируются |
| Code Quality | ✅ | Явные типы, нет any, SRP соблюдён |
| Conventions | ✅ | Trailing commas, комментарии на английском |

---

## Action Items

- [ ] [N1] Опционально: выделить метод `fetchBalances` для устранения дублирования
- [ ] [N3] Backlog: рассмотреть рефакторинг `domain/helpers` → use cases

---

## Verdict

**🟢 Approved** — код готов к мержу. Найденные замечания носят рекомендательный характер и не блокируют релиз.
