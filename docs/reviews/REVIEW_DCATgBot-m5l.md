# Review: Centralize Index Allocation Formatting

**Task:** DCATgBot-m5l
**Status:** Approved
**Date:** 2026-01-11

## Findings

### Critical

(none)

### Should Fix

(none)

### Consider

- [N1] Function comment documents output format but output depends on `TARGET_ALLOCATIONS` order which is not guaranteed in JS objects. Currently works because order matches definition, but could be fragile. Consider using explicit ordering if order matters for UX. -- `/Users/artem/Projects/DCATgBot/src/presentation/formatters/PortfolioFormatter.ts:11-17`

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| Function `formatTargetAllocations()` added to PortfolioFormatter.ts | PASS |
| Function returns fixed format derived from `TARGET_ALLOCATIONS` | PASS |
| Hardcoded strings in handlers.ts:1126-1129 replaced | PASS |
| Inline formatting in PortfolioFormatter.ts:28-30 replaced | PASS |
| Unified prefix format `"- "` across all usages | PASS |
| Build passes, no type errors | PASS (clean branch) |

## Implementation Details

**PortfolioFormatter.ts (lines 14-18):**
```typescript
export function formatTargetAllocations(): string {
  return Object.entries(TARGET_ALLOCATIONS)
    .map(([symbol, target]) => `- ${symbol}: ${(target * 100).toFixed(0)}%`)
    .join("\n");
}
```

**handlers.ts (line 1127):**
```typescript
text += formatTargetAllocations() + "\n\n";
```

**PortfolioFormatter.ts (line 41):**
```typescript
formatTargetAllocations() + "\n\n" +
```

**index.ts (line 6):**
```typescript
export { PortfolioFormatter, formatTargetAllocations } from "./PortfolioFormatter.js";
```

## Verdict

Implementation is clean and meets all acceptance criteria. The function correctly derives the allocation string from `TARGET_ALLOCATIONS`, eliminating hardcoded duplicates. Both usages in `handlers.ts` (start command) and `PortfolioFormatter.ts` (empty portfolio) now use the centralized function with consistent `"- "` prefix format.

The [N1] consideration about object key ordering is minor -- modern JS engines maintain insertion order for string keys, and `TARGET_ALLOCATIONS` is defined in the source code with SOL first. No action required unless strict ordering becomes a requirement.

**Approved for merge.**
