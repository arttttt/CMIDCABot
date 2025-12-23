# Code Review: Fix for Task 09 — Architecture Violations

**Reviewed:** Исправления C1, C3, N1-N3 из предыдущего ревью
**Date:** 2025-12-23
**Status:** 🟡 Approved with comments

---

## Summary

Исправления C1 (SecretStoreRepository) и N1-N3 (комментарии) выполнены корректно. Однако исправление C3 (KeyEncryptionService) выполнено **некорректно** — crypto перемещён в shared вместо создания интерфейса. Согласно ARCHITECTURE.md, crypto должен оставаться в `infrastructure/internal`, а domain должен зависеть от интерфейса.

---

## Findings

### 🟢 Correct (properly fixed)

#### [C1] SecretStoreRepository ✅

**Changes:**
- Создан интерфейс `SecretStoreRepository` в `domain/repositories/`
- `SecretCache` реализует интерфейс (`implements SecretStoreRepository`)
- Use cases принимают интерфейс через конструктор

**Verdict:** Соответствует Clean Architecture. Domain зависит от интерфейса, не от реализации.

---

#### [N1-N3] Комментарии ✅

**Changes:** `SolanaService` → `SolanaRpcClient` в трёх файлах.

**Verdict:** Корректно.

---

### 🟡 Should Fix (important but not blocking)

#### [S1] KeyEncryptionService перемещён в неправильное место

**Location:** `src/infrastructure/shared/crypto/`

**Issue:**
Согласно `prompts/ARCHITECTURE.md`:
```
infrastructure/
├── internal/            # only for data layer
│   └── crypto/          # KeyEncryption
```

Crypto должен быть в `internal`, не в `shared`. Текущее исправление нарушает документацию.

**Current state:**
```typescript
// domain/repositories/BlockchainRepository.ts:13
import type { KeyEncryptionService } from "../../infrastructure/shared/crypto/index.js";
```

Domain всё ещё зависит от конкретного типа из infrastructure.

**Expected (per ARCHITECTURE.md):**
```
domain → (nothing, only own interfaces)
```

**Suggestion:**
1. Создать интерфейс `EncryptionService` в `domain/repositories/`:
```typescript
export interface EncryptionService {
  encrypt(plaintext: string): Promise<string>;
  decrypt(encryptedBase64: string): Promise<string>;
  decryptToBuffer(encryptedBase64: string): Promise<Buffer>;
  isEncrypted(value: string): boolean;
}
```

2. `KeyEncryptionService` остаётся в `infrastructure/internal/crypto` и реализует интерфейс
3. Domain зависит от `EncryptionService` интерфейса
4. Инъекция конкретной реализации происходит в `index.ts`

**Impact:** Medium. Текущее решение работает, но нарушает документированную архитектуру.

---

### 🟢 Consider (observations)

#### [N4] Domain использует infrastructure/shared для logging и math

**Observation:**
```typescript
// Multiple domain files
import { logger } from "../../infrastructure/shared/logging/index.js";
import { divideAmount } from "../../infrastructure/shared/math/index.js";
```

Согласно ARCHITECTURE.md `domain → (nothing, only own interfaces)`, но на практике shared utilities (logging, math) используются.

**Suggestion:** Это может быть допустимым исключением для "pure" utilities. Документировать явно или создать интерфейсы.

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Сборка проходит, функционал работает |
| Architecture | ⚠️ | C1 — ✅, C3 — частично (crypto в неправильном месте) |
| Security | ✅ | Нет проблем |
| Code Quality | ✅ | Типы явные, интерфейсы определены |
| Conventions | ✅ | Комментарии обновлены |

---

## Action Items

- [x] [C1] SecretStoreRepository — правильно
- [ ] [S1] Создать интерфейс `EncryptionService` в domain (или обновить ARCHITECTURE.md)
- [x] [N1-N3] Комментарии — правильно

---

## Verdict

**Исправления частично корректны.**

- ✅ C1 (SecretStoreRepository) — образцовая реализация Dependency Inversion
- ⚠️ C3 (KeyEncryptionService) — перемещён в shared, что противоречит ARCHITECTURE.md. Нужно либо создать интерфейс (как для C1), либо обновить документацию

**Рекомендация:** Для консистентности применить тот же паттерн к `KeyEncryptionService`, что и к `SecretCache` — создать интерфейс в domain. Или принять решение обновить ARCHITECTURE.md, разрешив domain доступ к shared utilities.
