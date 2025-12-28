# Code Review: Gateway Core Architecture

**Reviewed:**
- `src/domain/models/UserIdentity.ts`
- `src/presentation/protocol/gateway/types.ts`
- `src/presentation/protocol/gateway/GatewayContext.ts`
- `src/presentation/protocol/gateway/Gateway.ts`
- `src/presentation/protocol/gateway/GatewayCore.ts`
- `src/presentation/protocol/gateway/stream.ts`
- `src/presentation/protocol/gateway/handlers/TelegramMessageHandler.ts`
- `src/presentation/protocol/gateway/handlers/TelegramCallbackHandler.ts`
- `src/presentation/protocol/gateway/handlers/HttpRequestHandler.ts`
- `src/presentation/protocol/gateway/index.ts`
- `src/presentation/commands/types.ts` (CommandExecutionContext)

**Date:** 2025-12-28
**Status:** 🟡 Approved with comments

---

## Summary

Реализация Gateway Core выполнена качественно. Архитектура соответствует Clean Architecture, типизация строгая, код читаемый. Есть одно нарушение конвенции проекта (top-level функции вместо класса со статическими методами) и несколько minor improvements.

---

## Findings

### 🔴 Critical (must fix before merge)

Нет критических замечаний.

---

### 🟡 Should Fix (important but not blocking)

#### [S1] Stream utilities используют top-level функции вместо класса

**Location:** `src/presentation/protocol/gateway/stream.ts:12-62`
**Issue:** Функции `mapStream`, `catchStream`, `final` экспортируются как top-level функции. Это нарушает конвенцию проекта из `ARCHITECTURE.md`:
> "Utility classes with static methods over loose functions"

**Impact:** Нарушение единообразия кодовой базы. Менее удобный autocomplete (нужно помнить имя каждой функции).

**Suggestion:**
```typescript
export class StreamUtils {
  static async *map(
    stream: ClientResponseStream,
    fn: (item: StreamItem) => StreamItem,
  ): ClientResponseStream {
    for await (const item of stream) {
      yield fn(item);
    }
  }

  static async *catch(
    factory: () => ClientResponseStream,
    onError: (error: unknown) => ClientResponse,
  ): ClientResponseStream {
    // ...
  }

  static final(response: ClientResponse): ClientResponseStream {
    // ...
  }
}
```

---

### 🟢 Consider (nice to have, minor improvements)

#### [N1] Type assertion в GatewayCore

**Location:** `src/presentation/protocol/gateway/GatewayCore.ts:26`
**Observation:** Используется `req as never` для обхода ограничений типов при dispatch. Это работает, но `never` — неочевидный выбор.
**Suggestion:** Рассмотреть использование более явного type assertion или комментарий с объяснением почему `never`:
```typescript
// TypeScript cannot infer that req.kind matches handler.kind after Map lookup
return handler.handle(req as Extract<GatewayRequest, { kind: typeof req.kind }>, ctx);
```

#### [N2] Дублирование сообщений об ошибках

**Location:**
- `src/presentation/protocol/gateway/handlers/TelegramMessageHandler.ts:28,37,43`
- `src/presentation/protocol/gateway/handlers/TelegramCallbackHandler.ts:27,33`

**Observation:** Одинаковые сообщения повторяются несколько раз:
- `"Unknown command. Use /help to see available commands."`
- `"Unknown action."`

**Suggestion:** Вынести в константы для единообразия и упрощения изменений:
```typescript
const MESSAGES = {
  UNKNOWN_COMMAND: "Unknown command. Use /help to see available commands.",
  UNKNOWN_ACTION: "Unknown action.",
} as const;
```

#### [N3] Отсутствует обработка @username suffix в командах

**Location:** `src/presentation/protocol/gateway/handlers/TelegramMessageHandler.ts:32`
**Observation:** Telegram позволяет писать команды как `/help@botname`. Текущий парсинг не удаляет `@botname` suffix.
**Suggestion:** Добавить очистку:
```typescript
const commandName = parts[0].slice(1).split("@")[0].toLowerCase();
```

---

## Checklist Results

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | ✅ | Логика корректна, edge cases обработаны |
| Architecture | ✅ | Clean Architecture соблюдена, слои разделены |
| Security | ✅ | Role masking работает, нет утечек |
| Code Quality | ✅ | Типы явные, SRP соблюден |
| Conventions | ⚠️ | stream.ts нарушает конвенцию utility classes |

---

## Action Items

- [ ] [S1] Рефакторинг stream.ts: обернуть функции в класс `StreamUtils`
- [ ] [N3] Добавить обработку @username suffix в TelegramMessageHandler (опционально)
