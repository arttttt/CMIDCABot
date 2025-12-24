# Code Review: Устранение дублирования логики расчёта аллокаций

**Reviewed:**
- `src/domain/usecases/GetPortfolioStatusUseCase.ts`
- `src/domain/usecases/ExecutePurchaseUseCase.ts`
- `src/domain/models/PurchaseStep.ts`
- `src/presentation/formatters/ProgressFormatter.ts`

**Date:** 2025-12-23
**Status:** 🟡 Approved with comments

---

## Summary

Рефакторинг успешно устранил дублирование — теперь `AllocationCalculator` единственный источник истины. Код компилируется, логика корректна. Однако есть вопросы к неймингу типов и расположению калькулятора в архитектуре.

---

## Findings

### 🟡 Should Fix (important but not blocking)

#### [S1] Нейминг `AllocationInfo` — слишком общее название

**Location:** `src/domain/models/PortfolioTypes.ts:13`

**Issue:** Суффикс `Info` — антипаттерн, не добавляет семантики. Название не отражает, что это "аллокация конкретного актива в портфеле".

**Контексты использования:**
1. `PortfolioStatus.allocations: AllocationInfo[]` — список аллокаций всех активов ✅
2. `PurchaseStep.selection: AllocationInfo` — выбранный актив для покупки ⚠️

Во втором контексте `AllocationInfo` семантически размыто — это не просто "информация", а конкретная аллокация выбранного актива.

**Suggestion:** Переименовать в `AssetAllocation`:
```typescript
// Более точное название
export interface AssetAllocation {
  symbol: AssetSymbol;
  balance: number;
  valueInUsdc: number;
  currentAllocation: number;
  targetAllocation: number;
  deviation: number;
}
```

Преимущества:
- Отражает суть: "аллокация актива"
- Следует паттерну `[Subject][What]` вместо `[What]Info`
- Читается естественно: `allocations: AssetAllocation[]`

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] Ключ лога `asset` вместо `symbol`

**Location:** `src/domain/usecases/ExecutePurchaseUseCase.ts:98`

**Observation:** В логе используется ключ `asset`, хотя поле переименовано в `symbol`:
```typescript
logger.info("ExecutePurchase", "Selected asset to buy", {
  asset: selection.symbol,  // ключ "asset", значение из "symbol"
  ...
});
```

**Suggestion:** Для консистентности можно оставить `asset` (это контекст лога, не поле объекта), либо унифицировать. Не критично.

---

#### [N2] Неиспользуемый импорт `AssetSymbol`

**Location:** `src/domain/usecases/ExecutePurchaseUseCase.ts:12`

**Observation:** Проверить, используется ли `AssetSymbol` после рефакторинга. Если только для `TARGET_ALLOCATIONS`, можно оставить.

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Логика расчётов сохранена, единый источник истины |
| Architecture | ✅ | Зависимости направлены внутрь, слои соблюдены |
| Security | ✅ | Нет изменений в security-sensitive коде |
| Code Quality | ⚠️ | Нейминг `AllocationInfo` можно улучшить |
| Conventions | ✅ | Trailing commas, английские комментарии |

---

## Action Items

- [ ] [S1] Переименовать `AllocationInfo` → `AssetAllocation`
