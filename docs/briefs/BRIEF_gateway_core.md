# Brief: Gateway Core Architecture

## Problem Statement

Текущий `ProtocolHandler` нарушает принцип единственной ответственности (SRP):
- Parsing команд
- Авторизация и проверка ролей
- Routing к handlers
- Специальная обработка `/help`
- Masking недоступных команд

Дополнительные проблемы:
- Дублирование логики между `handleCommand` и `handleCommandStreaming`
- Логика размазана между `ProtocolHandler`, `TelegramAdapter`, `router`
- Нет унификации обработки запросов для Telegram и HTTP (HttpServer уже существует)
- Отсутствует rate limiting, централизованная обработка ошибок

## Proposed Solution

Создать **Gateway** — унифицированную точку входа presentation layer с plugin architecture:

1. **Gateway** — композиция plugins через middleware chain (Koa-style)
2. **GatewayCore** — dispatcher (routing + masking), без policy-логики
3. **GatewayContext** — класс с инкапсулированным state и типизированным доступом
4. **UserIdentity** — transport-agnostic идентификация (discriminated union)
5. **Stream utilities** — утилиты для работы с `UIResponseStream`

## Technical Context

### Существующие компоненты
- `src/presentation/protocol/ProtocolHandler.ts` — текущая точка входа (будет заменена)
- `src/presentation/protocol/types.ts` — `UIResponse`, `UIStreamItem`, `UIResponseStream`
- `src/presentation/commands/router.ts` — routing по дереву команд
- `src/presentation/commands/types.ts` — `Command`, `CommandHandler`, `CommandRegistry`
- `src/presentation/telegram/TelegramAdapter.ts` — Telegram integration
- `src/infrastructure/shared/http/HttpServer.ts` — HTTP server (уже существует)
- `src/domain/models/AuthorizedUser.ts` — `UserRole`

### Clean Architecture
Gateway размещается в `presentation/protocol/gateway/` — это orchestration presentation layer, не domain.

## Scope v1

### Включено
- `UserIdentity` — discriminated union (`telegram` | `http`)
- `GatewayRequest` — unified request type (message / callback)
- `GatewayContext` — класс с `getRole()` / `setRole()`
- `GatewayHandler`, `GatewayPlugin` — типы для plugin chain
- `Gateway` — класс с plugin composition
- `GatewayCore` — dispatcher
- `CommandExecutionContext` — типизированный контекст для handlers
- Stream utilities: `mapStream`, `catchStream`, `final`

### Исключено (следующие итерации)
- Реализация плагинов (errorBoundary, loadRole, rateLimit, callbackValidation)
- Интеграция с TelegramAdapter
- Интеграция с HttpServer
- Миграция существующих команд на `CommandExecutionContext`

## Key Decisions

| Вопрос | Решение |
|--------|---------|
| UserIdentity | Discriminated union: `{ provider: "telegram"; telegramId: number }` / `{ provider: "http"; sessionId: string }` |
| GatewayContext | Класс с приватным state и методами `getRole()` / `setRole()` |
| Core dispatcher | Класс `GatewayCore` с методом `createHandler()` |
| Получение роли в core | `ctx.getRole()`, fallback на `"guest"` |
| Help | Обычная команда, не плагин |
| Callbacks | Wrap результат в `final()` |
| Миграция команд | Поэтапная (adapter в router) |
| Plugin composition | `reduceRight` (Koa-style middleware) |

## File Structure

```
src/
├── domain/models/
│   └── UserIdentity.ts              # NEW
│
└── presentation/
    ├── protocol/
    │   └── gateway/
    │       ├── types.ts             # GatewayRequest, GatewayHandler, GatewayPlugin
    │       ├── GatewayContext.ts    # NEW
    │       ├── Gateway.ts           # NEW
    │       ├── GatewayCore.ts       # NEW
    │       ├── stream.ts            # NEW
    │       └── index.ts
    │
    └── commands/
        └── types.ts                 # + CommandExecutionContext

```

---

## Technical Specification

### 1. UserIdentity

**Файл:** `src/domain/models/UserIdentity.ts`

Discriminated union (аналог sealed interface в Kotlin) для transport-agnostic идентификации:

```ts
export type UserIdentity =
  | { provider: "telegram"; telegramId: number }
  | { provider: "http"; sessionId: string };
```

**Преимущества:**
- Type-safe поля для каждого провайдера (`telegramId: number`, не string)
- Exhaustive checking в switch/if
- Легко расширять новыми провайдерами

**Использование:**
```ts
function getUserId(identity: UserIdentity): string {
  switch (identity.provider) {
    case "telegram":
      return String(identity.telegramId);
    case "http":
      return identity.sessionId;
  }
}
```

---

### 2. Gateway Types

**Файл:** `src/presentation/protocol/gateway/types.ts`

```ts
import type { UserIdentity } from "../../../domain/models/UserIdentity.js";
import type { UIResponseStream } from "../types.js";
import type { GatewayContext } from "./GatewayContext.js";

export type Transport = "telegram" | "http";

export type GatewayRequest =
  | {
      kind: "message";
      transport: Transport;
      identity: UserIdentity;
      text: string;
      username?: string;
    }
  | {
      kind: "callback";
      transport: Transport;
      identity: UserIdentity;
      callbackData: string;
    };

export type GatewayHandler = (
  req: GatewayRequest,
  ctx: GatewayContext,
) => Promise<UIResponseStream>;

export type GatewayPlugin = (next: GatewayHandler) => GatewayHandler;
```

**GatewayRequest** — discriminated union для двух типов запросов:
- `kind: "message"` — текстовое сообщение (команда)
- `kind: "callback"` — нажатие inline-кнопки

**GatewayPlugin** — функция-wrapper, принимает next handler и возвращает новый handler. Может:
- Short-circuit (вернуть ответ без вызова next)
- Модифицировать request/context перед вызовом next
- Трансформировать stream после вызова next

---

### 3. GatewayContext

**Файл:** `src/presentation/protocol/gateway/GatewayContext.ts`

Класс с инкапсулированным state и типизированным доступом:

```ts
import type { UserRole } from "../../../domain/models/AuthorizedUser.js";

export class GatewayContext {
  readonly requestId: string;
  readonly nowMs: number;
  private readonly state: Map<string, unknown>;

  constructor(requestId: string) {
    this.requestId = requestId;
    this.nowMs = Date.now();
    this.state = new Map();
  }

  setRole(role: UserRole): void {
    this.state.set("userRole", role);
  }

  getRole(): UserRole {
    return (this.state.get("userRole") as UserRole | undefined) ?? "guest";
  }
}
```

**Почему класс, а не interface:**
- Инкапсуляция state (private)
- Типизированные методы доступа вместо `Map<string, unknown>`
- Легко расширять новыми методами (set/get для других данных)
- Не нужен отдельный файл ctxKeys.ts

**Контракт:**
- Plugin `loadRole` вызывает `ctx.setRole(role)`
- GatewayCore читает через `ctx.getRole()`
- Если роль не установлена — возвращается `"guest"`

---

### 4. Gateway

**Файл:** `src/presentation/protocol/gateway/Gateway.ts`

Композиция plugins через middleware chain:

```ts
import type { GatewayHandler, GatewayPlugin, GatewayRequest } from "./types.js";
import type { GatewayContext } from "./GatewayContext.js";
import type { UIResponseStream } from "../types.js";

export class Gateway {
  private readonly handler: GatewayHandler;

  constructor(core: GatewayHandler, plugins: GatewayPlugin[]) {
    this.handler = plugins.reduceRight((next, plugin) => plugin(next), core);
  }

  handle(req: GatewayRequest, ctx: GatewayContext): Promise<UIResponseStream> {
    return this.handler(req, ctx);
  }
}
```

**Как работает reduceRight:**

```ts
// plugins = [errorBoundary, rateLimit, loadRole]
// core = GatewayCore.createHandler()

// reduceRight применяет справа налево:
// 1. loadRole(core)           → handler1
// 2. rateLimit(handler1)      → handler2
// 3. errorBoundary(handler2)  → final handler

// Порядок выполнения при запросе:
// errorBoundary → rateLimit → loadRole → core → loadRole → rateLimit → errorBoundary
```

**Пример создания:**
```ts
const core = new GatewayCore(registry);
const gateway = new Gateway(core.createHandler(), [
  errorBoundaryPlugin,
  rateLimitPlugin,
  loadRolePlugin,
]);

const ctx = new GatewayContext(crypto.randomUUID());
const stream = await gateway.handle(request, ctx);
```

---

### 5. Stream Utilities

**Файл:** `src/presentation/protocol/gateway/stream.ts`

Утилиты для работы с `UIResponseStream`:

```ts
import type { UIResponseStream, UIStreamItem, UIResponse } from "../types.js";

// Transform each item in stream
export async function* mapStream(
  stream: UIResponseStream,
  fn: (item: UIStreamItem) => UIStreamItem,
): UIResponseStream {
  for await (const item of stream) {
    yield fn(item);
  }
}

// Wrap stream with error handling
// Catches both sync errors (stream creation) and async errors (mid-stream)
export async function* catchStream(
  factory: () => UIResponseStream,
  onError: (error: unknown) => UIResponse,
): UIResponseStream {
  let stream: UIResponseStream;
  try {
    stream = factory();
  } catch (error) {
    yield { response: onError(error), mode: "final" };
    return;
  }

  try {
    for await (const item of stream) {
      yield item;
    }
  } catch (error) {
    yield { response: onError(error), mode: "final" };
  }
}

// Helper: wrap single response as final stream
export function final(response: UIResponse): UIResponseStream {
  async function* gen(): UIResponseStream {
    yield { response, mode: "final" };
  }
  return gen();
}
```

**Зачем catchStream принимает factory:**
- Ошибки могут происходить синхронно при создании стрима
- Ошибки могут происходить асинхронно внутри `for await`
- Factory позволяет поймать оба случая

**Использование в errorBoundary plugin:**
```ts
const errorBoundaryPlugin: GatewayPlugin = (next) => async (req, ctx) => {
  return catchStream(
    () => next(req, ctx),
    (error) => ({ text: "Internal error. Please try again." }),
  );
};
```

---

### 6. CommandExecutionContext

**Файл:** `src/presentation/commands/types.ts` (добавить к существующим типам)

Типизированный контекст для command handlers:

```ts
import type { UserRole } from "../../domain/models/AuthorizedUser.js";
import type { UserIdentity } from "../../domain/models/UserIdentity.js";
import type { Transport } from "../protocol/gateway/types.js";

export interface CommandExecutionContext {
  requestId: string;
  transport: Transport;
  identity: UserIdentity;
  role: UserRole;
}
```

**Изменение сигнатур команд (будущая миграция):**

```ts
// Было
handler?: (args: string[], telegramId: number) => Promise<UIResponse>;
streamingHandler?: (args: string[], telegramId: number) => UIResponseStream;

// Станет
handler?: (args: string[], ctx: CommandExecutionContext) => Promise<UIResponse>;
streamingHandler?: (args: string[], ctx: CommandExecutionContext) => UIResponseStream;
```

**Преимущества:**
- Роль доступна в handler (не нужно запрашивать повторно)
- Transport-agnostic (работает для Telegram и HTTP)
- requestId для логирования/трейсинга
- Легко расширять контекст

---

### 7. GatewayCore

**Файл:** `src/presentation/protocol/gateway/GatewayCore.ts`

Dispatcher — ядро обработки запросов:

```ts
import type { CommandRegistry } from "../../commands/types.js";
import type { GatewayHandler, GatewayRequest } from "./types.js";
import type { GatewayContext } from "./GatewayContext.js";
import type { UIResponseStream } from "../types.js";
import { final } from "./stream.js";
import { hasRequiredRole } from "../../../domain/models/AuthorizedUser.js";
import { routeCommandStreaming, findCallbackByPath } from "../../commands/router.js";

export class GatewayCore {
  constructor(private readonly registry: CommandRegistry) {}

  createHandler(): GatewayHandler {
    return (req, ctx) => this.handle(req, ctx);
  }

  private async handle(
    req: GatewayRequest,
    ctx: GatewayContext,
  ): Promise<UIResponseStream> {
    if (req.kind === "message") {
      return this.handleMessage(req, ctx);
    }
    return this.handleCallback(req, ctx);
  }

  private async handleMessage(
    req: Extract<GatewayRequest, { kind: "message" }>,
    ctx: GatewayContext,
  ): Promise<UIResponseStream> {
    const text = req.text.trim();

    // Non-command messages
    if (!text.startsWith("/")) {
      return final({ text: "Unknown command. Use /help to see available commands." });
    }

    // Parse command
    const parts = text.split(/\s+/);
    const commandName = parts[0].slice(1).toLowerCase(); // remove "/"
    const args = parts.slice(1);

    // Lookup command
    const cmd = this.registry.getCommand(commandName);
    if (!cmd) {
      return final({ text: `Unknown command: ${parts[0]}\nUse /help to see available commands.` });
    }

    // Role-based masking
    const role = ctx.getRole();
    if (cmd.requiredRole && !hasRequiredRole(role, cmd.requiredRole)) {
      return final({ text: `Unknown command: ${parts[0]}\nUse /help to see available commands.` });
    }

    // Build execution context
    const execCtx: CommandExecutionContext = {
      requestId: ctx.requestId,
      transport: req.transport,
      identity: req.identity,
      role,
    };

    // Route to handler
    return routeCommandStreaming(cmd, args, execCtx);
  }

  private async handleCallback(
    req: Extract<GatewayRequest, { kind: "callback" }>,
    ctx: GatewayContext,
  ): Promise<UIResponseStream> {
    const result = findCallbackByPath(this.registry.getCommands(), req.callbackData);
    if (!result) {
      return final({ text: "Unknown action." });
    }

    // Role-based masking
    const role = ctx.getRole();
    if (result.requiredRole && !hasRequiredRole(role, result.requiredRole)) {
      return final({ text: "Unknown action." });
    }

    // Build execution context
    const execCtx: CommandExecutionContext = {
      requestId: ctx.requestId,
      transport: req.transport,
      identity: req.identity,
      role,
    };

    // Execute callback and wrap in final
    const response = await result.handler(execCtx);
    return final(response);
  }
}
```

**Ответственности GatewayCore:**
1. Parse `/command args...`
2. Lookup command в registry
3. Проверка роли (masking) — недоступные команды = "Unknown command"
4. Формирование `CommandExecutionContext`
5. Вызов `routeCommandStreaming()` для messages
6. Вызов callback handler + wrap в `final()` для callbacks

**Что НЕ делает GatewayCore:**
- Загрузка роли (делает plugin loadRole)
- Rate limiting (делает plugin)
- Error handling (делает plugin errorBoundary)
- Валидация callbackData (делает plugin)

---

### 8. Exports

**Файл:** `src/presentation/protocol/gateway/index.ts`

```ts
export { Gateway } from "./Gateway.js";
export { GatewayContext } from "./GatewayContext.js";
export { GatewayCore } from "./GatewayCore.js";
export * from "./types.js";
export * from "./stream.js";
```

---

## Acceptance Criteria

- [ ] `UserIdentity` — discriminated union с `telegram` / `http` variants
- [ ] `GatewayContext` — класс с `getRole()` / `setRole()`
- [ ] `Gateway` — применяет plugins через `reduceRight`
- [ ] `GatewayCore` — dispatcher с методом `createHandler()`
- [ ] Stream utilities работают (`mapStream`, `catchStream`, `final`)
- [ ] `CommandExecutionContext` добавлен в `commands/types.ts`
- [ ] Все файлы компилируются без ошибок
- [ ] Нет интеграции (Telegram/HTTP адаптеры не затронуты)

## Open Questions for PM

1. **HTTP sessionId** — какой формат идентификатора для HTTP клиентов? (token, session id, API key?)
2. **Приоритет следующих итераций:**
   - Плагины (errorBoundary, loadRole, rateLimit)?
   - Интеграция с Telegram?
   - Интеграция с HTTP?
   - Миграция команд?
3. **Rate limiting** — требования к лимитам? (requests per minute, per user, global?)

## References

- `src/presentation/protocol/ProtocolHandler.ts` — текущая реализация
- `src/presentation/protocol/types.ts` — UI streaming contract
- `src/presentation/commands/router.ts` — command routing
- `src/presentation/commands/types.ts` — command types
- `src/presentation/telegram/TelegramAdapter.ts` — Telegram adapter
- `src/infrastructure/shared/http/HttpServer.ts` — HTTP server
- `src/domain/models/AuthorizedUser.ts` — UserRole
