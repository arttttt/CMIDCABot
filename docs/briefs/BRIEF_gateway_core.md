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
5. **Stream utilities** — утилиты для работы с `ResponseStream`

## Technical Context

### Существующие компоненты
- `src/presentation/protocol/ProtocolHandler.ts` — текущая точка входа (будет заменена)
- `src/presentation/protocol/types.ts` — `UIResponse`, `UIStreamItem`, `UIResponseStream` (будет переименован)
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
- `GatewayHandler` — интерфейс с методом `handle()`
- `GatewayPlugin` — интерфейс с методом `apply()`
- `Gateway` — класс с plugin composition
- `GatewayCore` — dispatcher, реализует `GatewayHandler`
- `CommandExecutionContext` — типизированный контекст для handlers
- Stream utilities: `mapStream`, `catchStream`, `final`
- Переименование `UIResponseStream` → `ResponseStream`

### Исключено (следующие итерации)
- Реализация плагинов (errorBoundary, loadRole, rateLimit, callbackValidation)
- Интеграция с TelegramAdapter
- Интеграция с HttpServer
- Миграция существующих команд на `CommandExecutionContext`

## Key Decisions

| Вопрос | Решение |
|--------|---------|
| UserIdentity | Discriminated union: `{ provider: "telegram"; telegramId: number }` / `{ provider: "http"; sessionId: string }` |
| GatewayContext | Класс с приватным state и методами `getRole()` / `setRole()`. Создаётся внутри `Gateway.handle()` |
| GatewayHandler | Интерфейс с методом `handle()` |
| GatewayPlugin | Интерфейс с методом `apply()`. Плагины — классы |
| Core dispatcher | Класс `GatewayCore`, реализует `GatewayHandler` |
| Получение роли в core | `ctx.getRole()`, fallback на `"guest"` |
| Help | Обычная команда, не плагин |
| Callbacks | Wrap результат в `final()` |
| Миграция команд | Поэтапная (adapter в router) |
| Plugin composition | `reduceRight` (Koa-style middleware) |
| Naming | `UIResponseStream` → `ResponseStream` |

## File Structure

```
src/
├── domain/models/
│   └── UserIdentity.ts              # NEW
│
└── presentation/
    ├── protocol/
    │   ├── types.ts                 # ResponseStream (переименован из UIResponseStream)
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

### 2. ResponseStream (переименование)

**Файл:** `src/presentation/protocol/types.ts`

Переименование существующего типа:

```ts
// Было
export type UIResponseStream = AsyncGenerator<UIStreamItem, void, undefined>;

// Стало
export type ResponseStream = AsyncGenerator<StreamItem, void, undefined>;
```

Также переименовать:
- `UIStreamItem` → `StreamItem`
- `UIResponse` — оставить как есть (это структура ответа, не stream)

---

### 3. Gateway Types

**Файл:** `src/presentation/protocol/gateway/types.ts`

```ts
import type { UserIdentity } from "../../../domain/models/UserIdentity.js";
import type { ResponseStream } from "../types.js";
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

export interface GatewayHandler {
  handle(req: GatewayRequest, ctx: GatewayContext): Promise<ResponseStream>;
}

export interface GatewayPlugin {
  apply(next: GatewayHandler): GatewayHandler;
}
```

**GatewayRequest** — discriminated union для двух типов запросов:
- `kind: "message"` — текстовое сообщение (команда)
- `kind: "callback"` — нажатие inline-кнопки

**GatewayHandler** — интерфейс для обработчика запросов. Реализуется:
- `GatewayCore` — финальный dispatcher
- Анонимными классами внутри плагинов (wrapping)

**GatewayPlugin** — интерфейс для плагинов. Метод `apply()`:
- Принимает next handler
- Возвращает новый handler (wrapper)
- Может short-circuit, модифицировать request/context, трансформировать stream

---

### 4. GatewayContext

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

**Контракт:**
- Plugin `loadRole` вызывает `ctx.setRole(role)`
- GatewayCore читает через `ctx.getRole()`
- Если роль не установлена — возвращается `"guest"`

---

### 5. Gateway

**Файл:** `src/presentation/protocol/gateway/Gateway.ts`

Композиция plugins через middleware chain:

```ts
import type { GatewayHandler, GatewayPlugin, GatewayRequest } from "./types.js";
import { GatewayContext } from "./GatewayContext.js";
import type { ResponseStream } from "../types.js";

export class Gateway {
  private readonly handler: GatewayHandler;

  constructor(core: GatewayHandler, plugins: GatewayPlugin[]) {
    this.handler = plugins.reduceRight(
      (next, plugin) => plugin.apply(next),
      core,
    );
  }

  handle(req: GatewayRequest): Promise<ResponseStream> {
    const ctx = new GatewayContext(crypto.randomUUID());
    return this.handler.handle(req, ctx);
  }
}
```

**Ключевые особенности:**
- `GatewayContext` создаётся внутри `handle()` — не нужно передавать снаружи
- `reduceRight` применяет плагины справа налево
- Результат — единый handler с полной цепочкой

**Как работает reduceRight:**

```ts
// plugins = [errorBoundary, rateLimit, loadRole]
// core = new GatewayCore(registry)

// reduceRight применяет справа налево:
// 1. loadRole.apply(core)           → handler1
// 2. rateLimit.apply(handler1)      → handler2
// 3. errorBoundary.apply(handler2)  → final handler

// Порядок выполнения при запросе:
// errorBoundary → rateLimit → loadRole → core → loadRole → rateLimit → errorBoundary
```

**Пример создания:**
```ts
const core = new GatewayCore(registry);
const gateway = new Gateway(core, [
  new ErrorBoundaryPlugin(),
  new RateLimitPlugin(config),
  new LoadRolePlugin(authHelper),
]);

const stream = await gateway.handle(request);
```

---

### 6. Stream Utilities

**Файл:** `src/presentation/protocol/gateway/stream.ts`

Утилиты для работы с `ResponseStream`:

```ts
import type { ResponseStream, StreamItem, UIResponse } from "../types.js";

// Transform each item in stream
export async function* mapStream(
  stream: ResponseStream,
  fn: (item: StreamItem) => StreamItem,
): ResponseStream {
  for await (const item of stream) {
    yield fn(item);
  }
}

// Wrap stream with error handling
// Catches both sync errors (stream creation) and async errors (mid-stream)
export async function* catchStream(
  factory: () => ResponseStream,
  onError: (error: unknown) => UIResponse,
): ResponseStream {
  let stream: ResponseStream;
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
export function final(response: UIResponse): ResponseStream {
  async function* gen(): ResponseStream {
    yield { response, mode: "final" };
  }
  return gen();
}
```

**Зачем catchStream принимает factory:**
- Ошибки могут происходить синхронно при создании стрима
- Ошибки могут происходить асинхронно внутри `for await`
- Factory позволяет поймать оба случая

**Использование в ErrorBoundaryPlugin:**
```ts
class ErrorBoundaryPlugin implements GatewayPlugin {
  apply(next: GatewayHandler): GatewayHandler {
    return {
      handle: (req, ctx) => {
        return catchStream(
          () => next.handle(req, ctx),
          (error) => ({ text: "Internal error. Please try again." }),
        );
      },
    };
  }
}
```

---

### 7. CommandExecutionContext

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
streamingHandler?: (args: string[], telegramId: number) => ResponseStream;

// Станет
handler?: (args: string[], ctx: CommandExecutionContext) => Promise<UIResponse>;
streamingHandler?: (args: string[], ctx: CommandExecutionContext) => ResponseStream;
```

**Преимущества:**
- Роль доступна в handler (не нужно запрашивать повторно)
- Transport-agnostic (работает для Telegram и HTTP)
- requestId для логирования/трейсинга
- Легко расширять контекст

---

### 8. GatewayCore

**Файл:** `src/presentation/protocol/gateway/GatewayCore.ts`

Dispatcher — ядро обработки запросов. Реализует `GatewayHandler`:

```ts
import type { CommandRegistry, CommandExecutionContext } from "../../commands/types.js";
import type { GatewayHandler, GatewayRequest } from "./types.js";
import type { GatewayContext } from "./GatewayContext.js";
import type { ResponseStream } from "../types.js";
import { final } from "./stream.js";
import { hasRequiredRole } from "../../../domain/models/AuthorizedUser.js";
import { routeCommandStreaming, findCallbackByPath } from "../../commands/router.js";

export class GatewayCore implements GatewayHandler {
  constructor(private readonly registry: CommandRegistry) {}

  async handle(req: GatewayRequest, ctx: GatewayContext): Promise<ResponseStream> {
    if (req.kind === "message") {
      return this.handleMessage(req, ctx);
    }
    return this.handleCallback(req, ctx);
  }

  private async handleMessage(
    req: Extract<GatewayRequest, { kind: "message" }>,
    ctx: GatewayContext,
  ): Promise<ResponseStream> {
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
  ): Promise<ResponseStream> {
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
- Загрузка роли (делает plugin LoadRolePlugin)
- Rate limiting (делает plugin RateLimitPlugin)
- Error handling (делает plugin ErrorBoundaryPlugin)
- Валидация callbackData (делает plugin CallbackValidationPlugin)

---

### 9. Plugin Example (для понимания структуры)

Пример плагина как класса:

```ts
import type { GatewayPlugin, GatewayHandler } from "./types.js";
import type { AuthorizationHelper } from "../../../domain/helpers/AuthorizationHelper.js";

export class LoadRolePlugin implements GatewayPlugin {
  constructor(private readonly authHelper: AuthorizationHelper) {}

  apply(next: GatewayHandler): GatewayHandler {
    return {
      handle: async (req, ctx) => {
        // Extract telegramId from identity
        if (req.identity.provider === "telegram") {
          const role = await this.authHelper.getRole(req.identity.telegramId);
          if (role) {
            ctx.setRole(role);
          }
        }
        // HTTP identity — другая логика авторизации (будущее)

        return next.handle(req, ctx);
      },
    };
  }
}
```

**Принципы:**
- Плагин — класс, реализующий `GatewayPlugin`
- Зависимости передаются через конструктор
- `apply()` возвращает объект с методом `handle()`
- Вызывает `next.handle()` для продолжения цепочки (или short-circuit)

---

### 10. Exports

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
- [ ] `ResponseStream` — переименован из `UIResponseStream`
- [ ] `GatewayHandler` — интерфейс с методом `handle()`
- [ ] `GatewayPlugin` — интерфейс с методом `apply()`
- [ ] `GatewayContext` — класс с `getRole()` / `setRole()`, создаётся внутри Gateway
- [ ] `Gateway` — применяет plugins через `reduceRight`, создаёт context внутри `handle()`
- [ ] `GatewayCore` — реализует `GatewayHandler`
- [ ] Stream utilities работают (`mapStream`, `catchStream`, `final`)
- [ ] `CommandExecutionContext` добавлен в `commands/types.ts`
- [ ] Все файлы компилируются без ошибок
- [ ] Нет интеграции (Telegram/HTTP адаптеры не затронуты)

## Open Questions for PM

1. **HTTP sessionId** — какой формат идентификатора для HTTP клиентов? (token, session id, API key?)
2. **Приоритет следующих итераций:**
   - Плагины (ErrorBoundaryPlugin, LoadRolePlugin, RateLimitPlugin)?
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
