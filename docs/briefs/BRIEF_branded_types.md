<!-- GitHub Issue: #189 -->
# BRIEF: Branded Types для ID

## Контекст

В проекте используются примитивные типы (`number`, `string`) для идентификаторов, которые семантически различны. Это создаёт риск случайной подмены одного типа другим — компилятор не поймает ошибку.

Предложение: ввести **branded types** (nominal typing через phantom brands) для всех ID.

## Текущее состояние

### Анализ ID в проекте

| ID тип | Текущий тип | Использование |
|--------|-------------|---------------|
| `telegramId` | `number` | Везде: domain, repositories, use cases, presentation |
| `signature` / `txSignature` | `string` | Транзакции Solana |
| `walletAddress` | `string` | Адрес кошелька пользователя |
| `tokenMint` | `string` | Адреса mint'ов токенов (USDC, cbBTC, wETH) |
| `userId` (presentation) | `string` | Строковое представление в адаптерах |

### Где находятся типы

- **Domain модели:** `src/domain/models/User.ts`, `Transaction.ts`, `Purchase.ts`
- **Repository интерфейсы:** `src/domain/repositories/`
- **Presentation:** `src/presentation/protocol/types.ts`
- **Database:** `src/data/types/database.ts`

## Требования

### Функциональные

1. Branded types для **всех ID**:
   - `TelegramId` — ID пользователя Telegram (`number`)
   - `TxSignature` — подпись транзакции Solana (88 символов base58)
   - `WalletAddress` — адрес кошелька пользователя
   - `TokenMint` — адрес mint'а токена (USDC, cbBTC, wETH)
   - `RequestId` — UUID для трейсинга запросов
   - `SessionId` — ID HTTP-сессии

2. Конструкторы с валидацией формата (runtime check)

3. Type guards для narrowing

### Нефункциональные

1. Zero runtime overhead после валидации (branded type = примитив с phantom brand)
2. Compile-time safety — нельзя передать `WalletAddress` где ожидается `TokenMint`
3. Постепенная миграция — можно внедрять по одному типу
4. **Правило в conventions.md** — все новые ID должны использовать branded types

## Решение: Branded Types через intersection

### Структура файлов

```
src/domain/models/id/
├── TelegramId.ts
├── TxSignature.ts
├── WalletAddress.ts
├── TokenMint.ts
└── index.ts  // re-export
```

### Паттерн (для каждого файла)

```typescript
// src/domain/models/id/TelegramId.ts

declare const __brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type TelegramId = Brand<number, 'TelegramId'>;

// Exception: top-level function allowed for branded type constructors
export function telegramId(value: number): TelegramId {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid Telegram ID: ${value}`);
  }
  return value as TelegramId;
}
```

```typescript
// src/domain/models/id/TxSignature.ts

export type TxSignature = Brand<string, 'TxSignature'>;

export function txSignature(value: string): TxSignature {
  // Solana signature: 87-88 characters base58
  if (!/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(value)) {
    throw new Error(`Invalid transaction signature: ${value}`);
  }
  return value as TxSignature;
}
```

```typescript
// src/domain/models/id/WalletAddress.ts

export type WalletAddress = Brand<string, 'WalletAddress'>;

export function walletAddress(value: string): WalletAddress {
  // Solana address: 32-44 characters base58
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) {
    throw new Error(`Invalid wallet address: ${value}`);
  }
  return value as WalletAddress;
}
```

```typescript
// src/domain/models/id/TokenMint.ts

export type TokenMint = Brand<string, 'TokenMint'>;

export function tokenMint(value: string): TokenMint {
  // Same format as wallet address
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) {
    throw new Error(`Invalid token mint: ${value}`);
  }
  return value as TokenMint;
}
```

```typescript
// src/domain/models/id/index.ts

export { TelegramId, telegramId } from './TelegramId';
export { TxSignature, txSignature } from './TxSignature';
export { WalletAddress, walletAddress } from './WalletAddress';
export { TokenMint, tokenMint } from './TokenMint';
```

### Почему без unsafe-конструкторов

Валидация обязательна везде — даже для данных из БД. Это гарантирует целостность на всех уровнях.

### Использование

```typescript
// До
interface User {
  telegramId: number;
  walletAddress: string | null;
}

function getById(telegramId: number): Promise<User | null>;

// После
import { TelegramId, WalletAddress } from '@/domain/types/branded';

interface User {
  telegramId: TelegramId;
  walletAddress: WalletAddress | null;
}

function getById(telegramId: TelegramId): Promise<User | null>;
```

### Compile-time protection

```typescript
const odminId = telegramId(123456789);
const wallet = walletAddress('So11111111111111111111111111111111111111112');
const mint = tokenMint('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// ✅ Компилируется
getById(odminId);
getBalances(wallet);

// ❌ Type error: Argument of type 'TokenMint' is not assignable to 'WalletAddress'
getBalances(mint);

// ❌ Type error: Argument of type 'number' is not assignable to 'TelegramId'
getById(123456789);
```

## Правило для conventions.md

Добавить изменения в `conventions.md`:

### 1. Обновить правило Structure

```markdown
### Structure
- Small modules — single responsibility
- Utility functions — class with static methods (not top-level exports)
- **Exception:** branded type constructors — top-level functions allowed (see Branded Types)
```

### 2. Добавить секцию Branded Types

```markdown
## Branded Types для ID

Все идентификаторы должны использовать branded types из `src/domain/models/id/`:

- `TelegramId` — ID пользователя Telegram
- `TxSignature` — подпись транзакции Solana
- `WalletAddress` — адрес кошелька
- `TokenMint` — адрес mint'а токена

**Запрещено** использовать примитивы (`number`, `string`) для ID напрямую.

При добавлении нового типа ID:
1. Создать файл в `src/domain/models/id/<TypeName>.ts`
2. Определить branded type и конструктор с валидацией
3. Добавить re-export в `index.ts`
```

## Зависимости

- Нет внешних зависимостей
- `BlockchainRepository.isValidAddress()` можно заменить конструктором `walletAddress()`

## Файлы для создания/изменения

### Новые файлы

```
src/domain/models/id/
├── TelegramId.ts
├── TxSignature.ts
├── WalletAddress.ts
├── TokenMint.ts
└── index.ts
```

### Миграция (поэтапно)

**Этап 1: TelegramId**
- `src/domain/models/User.ts` — все user types
- `src/domain/models/Transaction.ts`, `Purchase.ts`, `Portfolio.ts`
- `src/domain/repositories/` — все интерфейсы
- `src/application/usecases/` — все use cases
- `src/data/repositories/` — все реализации
- `src/presentation/` — адаптеры и handlers

**Этап 2: TxSignature**
- `src/domain/models/Transaction.ts` — `txSignature: TxSignature`
- `src/domain/models/SwapStep.ts` — `signature: TxSignature`
- `src/domain/repositories/BlockchainRepository.ts` — `SendTransactionResult`
- `src/data/repositories/SQLiteTransactionRepository.ts` — маппинг

**Этап 3: WalletAddress**
- `src/domain/models/User.ts` — `walletAddress` поля
- `src/domain/repositories/UserRepository.ts`
- `src/domain/repositories/BalanceRepository.ts`
- `src/data/repositories/` — все repository реализации

**Этап 4: TokenMint**
- `src/domain/models/Token.ts`
- `src/domain/models/Balance.ts`
- `src/domain/models/Portfolio.ts`
- Конфигурация токенов

## Риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Много изменений за раз | Средняя | Поэтапная миграция |
| Runtime ошибки при валидации | Низкая | Валидация простая, данные из БД уже проверены при записи |
| Забыть обновить тесты | Средняя | Компилятор поймает несоответствия типов |

## Альтернативы (отклонены)

### Newtype через class

```typescript
class WalletAddress {
  constructor(readonly value: string) { validate(value); }
}
```

**Минусы:** Runtime overhead, нужен `.value` везде, сложнее интеграция с существующим кодом.

### Template literal types

```typescript
type WalletAddress = `wallet:${string}`;
```

**Минусы:** Меняет runtime формат, не подходит для хранения в БД.

### Zod/io-ts

**Минусы:** Внешняя зависимость, overkill для branded types.

## Scope

### Включено
- Branded types для `TelegramId`, `TxSignature`, `WalletAddress`, `TokenMint`, `RequestId`, `SessionId`
- Конструкторы с валидацией (без unsafe-версий)
- Миграция всех слоёв (один PR)
- Правило в conventions.md

### Исключено
- `userId` в presentation — строковое представление для адаптеров, конвертация явная
- `InviteToken.token` — изолирован, отдельный контекст (можно добавить позже)

## Оценка трудозатрат

| Этап | Объём | Описание |
|------|-------|----------|
| 1. TelegramId | ~30 файлов | Самый широко используемый ID |
| 2. TxSignature | ~5 файлов | Изолирован в blockchain/transaction слое |
| 3. WalletAddress | ~15 файлов | Domain и data слои |
| 4. TokenMint | ~10 файлов | Конфигурация и балансы |

## Следующий шаг

Создать TASK для первого этапа (TelegramId).
