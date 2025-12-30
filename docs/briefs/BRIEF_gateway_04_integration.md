<!-- GitHub Issue: #172 -->
# Brief: Gateway Integration with Telegram

## Problem Statement

Gateway и все компоненты реализованы, но не используются:
- `TelegramAdapter` использует старый `ProtocolHandler`
- `index.ts` создаёт `ProtocolHandler`, не `Gateway`
- Два параллельных пути обработки запросов (нарушение DRY)
- `getAvailableCommands()` — debug-метод, не нужен в Gateway

## Proposed Solution

Интегрировать Gateway в существующую инфраструктуру:

1. **Адаптер** — преобразование grammY Context в `GatewayRequest`
2. **Рефакторинг TelegramAdapter** — использование `Gateway.handle()` вместо `ProtocolHandler`
3. **Обновление index.ts** — создание `Gateway` через `GatewayFactory`
4. **Deprecation** — пометить `ProtocolHandler` как `@deprecated`

## Technical Context

### Текущая архитектура

```
index.ts
├── createRegistryAndHandler() → { registry, handler: ProtocolHandler }
├── createTelegramBot(token, handler, isDev)
│   └── TelegramAdapter
│       ├── bot.on("message:text") → handler.handleMessageStreaming()
│       └── bot.on("callback_query:data") → handler.handleCallback()
└── handler.getAvailableCommands() → console.log (debug only)
```

### Целевая архитектура

```
index.ts
├── GatewayFactory.create(deps) → Gateway
├── createTelegramBot(token, gateway, isDev)
│   └── TelegramAdapter
│       ├── bot.on("message:text") → buildRequest() → gateway.handle()
│       └── bot.on("callback_query:data") → buildRequest() → gateway.handle()
└── (no getAvailableCommands)
```

### Ключевые файлы

| Файл | Роль |
|------|------|
| `src/presentation/telegram/TelegramAdapter.ts` | Адаптер grammY ↔ Protocol |
| `src/presentation/protocol/ProtocolHandler.ts` | Старый handler (→ @deprecated) |
| `src/presentation/protocol/gateway/Gateway.ts` | Новый Gateway |
| `src/index.ts` | Точка входа |

## Scope

### Included

1. **Функция `buildGatewayRequest`** — преобразование grammY Context в `GatewayRequest`
2. **Рефакторинг `createTelegramBot`** — принимает `Gateway` вместо `ProtocolHandler`
3. **Обновление `index.ts`**:
   - Создание `Gateway` через `GatewayFactory`
   - Удаление вызова `getAvailableCommands()`
4. **Deprecation `ProtocolHandler`** — добавить `@deprecated` JSDoc

### Excluded

- Удаление `ProtocolHandler` (оставляем deprecated)
- Callback validation refactoring (оставить в TelegramAdapter как есть)
- HTTP интеграция (отдельный бриф)
- Миграция команд на `CommandExecutionContext` (отложено)

## Key Decisions

| Вопрос | Решение | Обоснование |
|--------|---------|-------------|
| Что принимает `createTelegramBot`? | `Gateway` | Новый контракт, clean interface |
| Где строится `GatewayRequest`? | В TelegramAdapter | Знание о grammY Context локализовано |
| Streaming логика? | Остаётся в TelegramAdapter | Специфична для Telegram |
| Callback validation? | Остаётся в TelegramAdapter | Оставить как есть, улучшить позже |
| `getAvailableCommands()`? | Убрать | Debug-only, не нужен |
| `ProtocolHandler`? | `@deprecated` | Удаление в отдельном PR |

## Technical Specification

### 1. buildGatewayRequest

**Файл:** `src/presentation/telegram/TelegramAdapter.ts`

```typescript
import type { GatewayRequest } from "../protocol/gateway/types.js";

function buildTelegramMessageRequest(ctx: Context): GatewayRequest {
  return {
    kind: "telegram-message",
    identity: {
      provider: "telegram",
      telegramId: ctx.from!.id,
    },
    text: ctx.message!.text!,
    username: ctx.from!.username,
  };
}

function buildTelegramCallbackRequest(ctx: Context): GatewayRequest {
  return {
    kind: "telegram-callback",
    identity: {
      provider: "telegram",
      telegramId: ctx.from!.id,
    },
    callbackData: ctx.callbackQuery!.data!,
  };
}
```

### 2. Изменение createTelegramBot

**Файл:** `src/presentation/telegram/TelegramAdapter.ts`

```typescript
import type { Gateway } from "../protocol/gateway/Gateway.js";

export function createTelegramBot(
  botToken: string,
  gateway: Gateway,  // ← было: handler: ProtocolHandler
  isDev: boolean,
): Bot<Context> {
  // ...

  bot.on("message:text", async (ctx) => {
    const request = buildTelegramMessageRequest(ctx);
    const stream = await gateway.handle(request);
    await handleStreamingResponse(ctx, stream);
  });

  bot.on("callback_query:data", async (ctx) => {
    // Existing callback validation stays here
    // ...validation code...

    const request = buildTelegramCallbackRequest(ctx);
    const stream = await gateway.handle(request);
    await handleCallbackResponse(ctx, stream);
  });
}
```

### 3. Обновление index.ts

```typescript
// Remove: import { ProtocolHandler } from ...
import { GatewayFactory } from "./presentation/protocol/gateway/index.js";

// In main():
const gateway = GatewayFactory.create({
  authRepository,
  ownerTelegramId: config.telegram.ownerTelegramId,
  commandRegistry: registry,
});

// Remove: console.log(...handler.getAvailableCommands()...)

const bot = createTelegramBot(config.telegram.botToken, gateway, config.isDev);
```

### 4. Deprecation ProtocolHandler

**Файл:** `src/presentation/protocol/ProtocolHandler.ts`

```typescript
/**
 * Protocol handler for command dispatch
 *
 * @deprecated Use Gateway instead. Will be removed in future version.
 * @see Gateway
 */
export class ProtocolHandler {
  // ...existing code...
}
```

## File Changes

| Файл | Изменение |
|------|-----------|
| `src/presentation/telegram/TelegramAdapter.ts` | + buildGatewayRequest, изменить createTelegramBot |
| `src/presentation/protocol/ProtocolHandler.ts` | + @deprecated JSDoc |
| `src/index.ts` | GatewayFactory вместо ProtocolHandler |

## Acceptance Criteria

- [ ] `createTelegramBot` принимает `Gateway` вместо `ProtocolHandler`
- [ ] Функции `buildTelegramMessageRequest` и `buildTelegramCallbackRequest` созданы
- [ ] `index.ts` создаёт `Gateway` через `GatewayFactory`
- [ ] Вызов `getAvailableCommands()` удалён из `index.ts`
- [ ] `ProtocolHandler` помечен `@deprecated`
- [ ] Все существующие команды работают через Gateway
- [ ] Callback validation остаётся в TelegramAdapter
- [ ] Streaming логика работает без изменений
- [ ] Проект компилируется без ошибок
- [ ] Бот запускается и обрабатывает команды

## Open Questions for PM

1. **Логирование при старте** — нужно ли заменить `getAvailableCommands()` на другой способ показать количество команд, или убрать полностью?

## References

- `src/presentation/protocol/gateway/` — Gateway модуль
- `docs/briefs/BRIEF_gateway_01_core.md` — Gateway Core
- `docs/briefs/BRIEF_gateway_02_plugins.md` — Plugins
- `docs/briefs/BRIEF_gateway_03a_factory.md` — Factory
- `conventions.md` — правила проекта
