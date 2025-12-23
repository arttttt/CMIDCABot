# Code Review: S1/S2 Architecture Fixes

**Reviewed:** Исправления S1 (crypto в internal) и S2 (DI через конструктор)
**Date:** 2025-12-23
**Status:** 🟢 Approved

---

## Summary

Все исправления выполнены корректно. Архитектурные нарушения устранены:
- crypto перемещён в `infrastructure/internal/` — domain больше не зависит от encryption
- `encryptionService` инжектится через конструктор `SolanaRpcClient`
- Добавлен `getDecryptedPrivateKey()` в `UserRepository` для чистого API без leaky abstraction

---

## Findings

### 🟢 All Issues Fixed

#### [S1] KeyEncryptionService в правильном месте ✅

**Verification:**
```
infrastructure/internal/crypto/  — только data layer импортирует
├── KeyEncryption.ts
└── index.ts

Импорты из internal (все в data layer):
- src/data/factories/RepositoryFactory.ts
- src/data/sources/api/SolanaRpcClient.ts
- src/data/sources/memory/SecretCache.ts
- src/data/repositories/memory/InMemoryUserRepository.ts
- src/data/repositories/sqlite/SQLiteUserRepository.ts
- src/index.ts (composition root — допустимо)
```

**Verdict:** Domain НЕ импортирует из `infrastructure/internal` — соответствует ARCHITECTURE.md.

---

#### [S2] DI через конструктор ✅

**Changes:**
```typescript
// SolanaRpcClient.ts:143
constructor(config: SolanaConfig, encryptionService: KeyEncryptionService) {
  this.encryptionService = encryptionService;
}

// BlockchainRepository.ts:148-151 — чистый интерфейс
signAndSendTransactionSecure(
  transactionBase64: string,
  encryptedPrivateKey: string,
): Promise<SendTransactionResult>;
```

**Verdict:** Leaky abstraction устранена. Интерфейс не знает о деталях шифрования.

---

#### [+] getDecryptedPrivateKey() в UserRepository ✅

**Location:** `src/domain/repositories/UserRepository.ts:36`

**Implementation:**
```typescript
// Interface (domain)
getDecryptedPrivateKey(telegramId: number): Promise<string | null>;

// InMemoryUserRepository.ts:90-95
async getDecryptedPrivateKey(telegramId: number): Promise<string | null> {
  const user = this.users.get(telegramId);
  if (!user?.privateKey) return null;
  return this.encryptionService.decrypt(user.privateKey);
}

// SQLiteUserRepository.ts:118-128
async getDecryptedPrivateKey(telegramId: number): Promise<string | null> {
  const row = await this.db.selectFrom("users")...
  if (!row?.private_key) return null;
  return this.encryptionService.decrypt(row.private_key);
}
```

**Verdict:** Хорошее решение — domain получает расшифрованный ключ через абстракцию, не зная о шифровании.

---

#### [+] ARCHITECTURE.md обновлён ✅

**Change:**
```markdown
domain → infrastructure/shared (logging, math, config)
```

**Verdict:** Документация соответствует реальному использованию.

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Сборка проходит, логика корректна |
| Architecture | ✅ | Domain → shared OK, Domain → internal НИГДЕ |
| Security | ✅ | Ключи расшифровываются только в data layer |
| Code Quality | ✅ | Типы явные, интерфейсы чистые |
| Conventions | ✅ | Trailing commas, comments in English |

---

## Verification

```bash
# Domain НЕ импортирует из internal
grep -r "infrastructure/internal" src/domain/
# (пусто — правильно)

# Data layer импортирует из internal
grep -r "infrastructure/internal" src/data/
# 5 файлов — правильно
```

---

## Action Items

Нет — все исправления выполнены корректно.

---

## Verdict

**🟢 Approved**

Все архитектурные нарушения исправлены:
- ✅ S1 — crypto в `infrastructure/internal/`, domain не зависит
- ✅ S2 — DI через конструктор, чистый интерфейс
- ✅ Добавлен `getDecryptedPrivateKey()` для clean API
- ✅ ARCHITECTURE.md обновлён

Можно мержить.
