<!-- GitHub Issue: #192 -->
# Task: C-01 Wallet Creation Transactionality

## Context

Wallet creation in `CreateWalletUseCase` performs three sequential operations without transactional guarantee: `setPrivateKey`, `setWalletAddress`, and `secretStore.store`. A failure between operations can leave the system in an inconsistent state where the user has a partial wallet (e.g., private key saved but no address, or wallet data saved but seed phrase lost). This is critical because a lost seed phrase means permanent loss of wallet recovery capability.

## Acceptance Criteria

- [x] `secretStore.store()` is called BEFORE any database writes
- [x] `setPrivateKey` and `setWalletAddress` are executed atomically in a single database transaction
- [x] New method `setWalletData(telegramId, privateKey, walletAddress)` added to `UserRepository` interface
- [x] `SQLiteUserRepository.setWalletData` uses `db.transaction()` for atomic write
- [x] `CreateWalletUseCase` implements retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
- [x] After exhausting retries, error is propagated to the caller
- [x] Errors are logged via existing `logger.error`
- [x] Code compiles without errors
- [ ] Bot starts and `/start` command creates wallet successfully

## Scope

### Included

- Reorder operations in `CreateWalletUseCase`: secretStore first, then database
- Add `setWalletData` method to `UserRepository` interface
- Implement `setWalletData` in `SQLiteUserRepository` with Kysely transaction
- Implement retry logic in `CreateWalletUseCase` (3 attempts, exponential backoff)
- Update `CreateWalletUseCase` to use new `setWalletData` method instead of separate calls

### Files to modify

- `src/domain/repositories/UserRepository.ts`
- `src/data/repositories/sqlite/SQLiteUserRepository.ts`
- `src/domain/usecases/CreateWalletUseCase.ts`

## Out of Scope

- Recovery mechanism for existing users with inconsistent state
- Admin notifications on critical failures
- Changes to `SecretCache` or `SecretStoreRepository`
- Unit tests
- Removal of existing `setPrivateKey` / `setWalletAddress` methods (they may be used elsewhere)

## Technical Notes

### Operation order (SecretStore first)

```typescript
// 1. Store seed phrase first - if this fails, DB is untouched
const seedUrl = await this.secretStore.store(keypair.mnemonic, telegramId);

// 2. Atomically write to database
await this.userRepository.setWalletData(telegramId, keypair.privateKeyBase64, keypair.address);
```

If step 2 fails, the seed phrase will expire via TTL (5 minutes) - acceptable trade-off.

### New repository method

```typescript
// UserRepository.ts
interface UserRepository {
  // ... existing methods

  /**
   * Atomically set wallet private key and address.
   * Both values are written in a single transaction.
   */
  setWalletData(
    telegramId: TelegramId,
    privateKey: string,
    walletAddress: WalletAddress
  ): Promise<void>;
}
```

### SQLite implementation with transaction

```typescript
// SQLiteUserRepository.ts
async setWalletData(
  id: TelegramId,
  privateKey: string,
  address: WalletAddress
): Promise<void> {
  const encryptedKey = await this.encryptPrivateKey(privateKey);

  await this.db.transaction().execute(async (trx) => {
    await trx
      .updateTable("users")
      .set({
        private_key: encryptedKey,
        wallet_address: address.value,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where("telegram_id", "=", id.value)
      .execute();
  });
}
```

### Retry logic pattern

```typescript
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    // ... wallet creation logic
    return result;
  } catch (error) {
    logger.error("CreateWallet", `Attempt ${attempt} failed`, { error, telegramId });

    if (attempt === MAX_RETRIES) {
      throw error;
    }

    const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
    await sleep(delay);
  }
}
```

### Why this approach

1. **SecretStore first**: If seed storage fails, database remains clean - no partial state
2. **DB transaction**: Kysely's `db.transaction()` ensures private key and address are written atomically
3. **Retry with backoff**: Handles transient failures (network, lock contention) automatically
4. **Clean Architecture**: Transaction logic encapsulated in repository, UseCase stays clean
