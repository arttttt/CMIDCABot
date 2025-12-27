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
5. **Stream utilities** — утилиты для работы с `ClientResponseStream`

## Technical Context

### Существующие компоненты
- `src/presentation/protocol/ProtocolHandler.ts` — текущая точка входа (будет заменена)
- `src/presentation/protocol/types.ts` — `UIResponse`, `UIStreamItem`, `UIResponseStream` (будут переименованы)
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
- Переименование: `UIResponse` → `ClientResponse`, `UIResponseStream` → `ClientResponseStream`, `UIStreamItem` → `StreamItem`

### Исключено (следующие итерации)
- Реализация плагинов (errorBoundary, loadRole, rateLimit, callbackValidation)
- Интеграция с TelegramAdapter
- Интеграция с HttpServer
- Миграция существующих команд на `CommandExecutionContext`

## Key Decisions

| Вопрос | Решение |
|--------|---------|
| UserIdentity | Discriminated union: `{ provider: "telegram"; telegramId: number }` / `{ provider: "http"; sessionId: string }` |
| GatewayRequest | Три kind: `telegram-message`, `telegram-callback`, `http-request` |
| GatewayContext | Класс с приватным state и методами `getRole()` / `setRole()`. Создаётся внутри `Gateway.handle()` |
| GatewayHandler | Интерфейс с методом `handle()` |
| GatewayPlugin | Интерфейс с методом `apply()`. Плагины — классы |
| Core dispatcher | Класс `GatewayCore` — только dispatch на handlers |
| Request handlers | Отдельные классы: `TelegramMessageHandler`, `TelegramCallbackHandler`, `HttpRequestHandler` |
| Получение роли в core | `ctx.getRole()`, fallback на `"guest"` |
| Help | Обычная команда, не плагин |
| Callbacks | Wrap результат в `final()` |
| Миграция команд | Поэтапная (adapter в router) |
| Plugin composition | `reduceRight` (Koa-style middleware) |
| Naming | `UIResponse` → `ClientResponse`, `UIResponseStream` → `ClientResponseStream`, `UIStreamItem` → `StreamItem` |
| HTTP структура | TBD — требует исследования текущего HttpServer |

## File Structure

```
src/
├── domain/models/
│   └── UserIdentity.ts              # NEW
│
└── presentation/
    ├── protocol/
    │   ├── types.ts                 # ClientResponse, ClientResponseStream, StreamItem
    │   └── gateway/
    │       ├── types.ts             # GatewayRequest, GatewayHandler, GatewayPlugin, RequestHandler
    │       ├── GatewayContext.ts    # NEW
    │       ├── Gateway.ts           # NEW
    │       ├── GatewayCore.ts       # NEW — только dispatch
    │       ├── handlers/
    │       │   ├── TelegramMessageHandler.ts   # NEW
    │       │   ├── TelegramCallbackHandler.ts  # NEW
    │       │   └── HttpRequestHandler.ts       # NEW (TBD)
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

### 2. Переименование типов

**Файл:** `src/presentation/protocol/types.ts`

Переименование существующих типов:

```ts
// Было
export interface UIResponse { ... }
export interface UIStreamItem { ... }
export type UIResponseStream = AsyncGenerator<UIStreamItem, void, undefined>;

// Стало
export interface ClientResponse { ... }
export interface StreamItem { ... }
export type ClientResponseStream = AsyncGenerator<StreamItem, void, undefined>;
```

Итого:
- `UIResponse` → `ClientResponse`
- `UIStreamItem` → `StreamItem`
- `UIResponseStream` → `ClientResponseStream`

---

### 3. Gateway Types

**Файл:** `src/presentation/protocol/gateway/types.ts`

```ts
import type { UserIdentity } from "../../../domain/models/UserIdentity.js";
import type { ClientResponseStream } from "../types.js";
import type { GatewayContext } from "./GatewayContext.js";

export type GatewayRequest =
  | {
      kind: "telegram-message";
      identity: Extract<UserIdentity, { provider: "telegram" }>;
      text: string;
      username?: string;
    }
  | {
      kind: "telegram-callback";
      identity: Extract<UserIdentity, { provider: "telegram" }>;
      callbackData: string;
    }
  | {
      kind: "http-request";
      identity: Extract<UserIdentity, { provider: "http" }>;
      // TBD: структура будет уточнена после исследования HTTP server
      path: string;
      method: string;
      body?: unknown;
    };

export interface GatewayHandler {
  handle(req: GatewayRequest, ctx: GatewayContext): Promise<ClientResponseStream>;
}

export interface GatewayPlugin {
  apply(next: GatewayHandler): GatewayHandler;
}

export interface RequestHandler<K extends GatewayRequest["kind"]> {
  readonly kind: K;
  handle(
    req: Extract<GatewayRequest, { kind: K }>,
    ctx: GatewayContext,
  ): Promise<ClientResponseStream>;
}
```

**GatewayRequest** — discriminated union для трёх типов запросов:
- `kind: "telegram-message"` — текстовое сообщение (команда)
- `kind: "telegram-callback"` — нажатие inline-кнопки
- `kind: "http-request"` — HTTP запрос (структура TBD)

**GatewayHandler** — интерфейс для обработчика запросов. Реализуется:
- `GatewayCore` — финальный dispatcher
- Анонимными классами внутри плагинов (wrapping)

**GatewayPlugin** — интерфейс для плагинов. Метод `apply()`:
- Принимает next handler
- Возвращает новый handler (wrapper)
- Может short-circuit, модифицировать request/context, трансформировать stream

**RequestHandler<K>** — интерфейс для обработчиков конкретных типов запросов:
- Типизирован по `kind`
- Каждый handler обрабатывает только свой тип запроса
- GatewayCore диспатчит на соответствующий handler

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
import type { ClientResponseStream } from "../types.js";

export class Gateway {
  private readonly handler: GatewayHandler;

  constructor(core: GatewayHandler, plugins: GatewayPlugin[]) {
    this.handler = plugins.reduceRight(
      (next, plugin) => plugin.apply(next),
      core,
    );
  }

  handle(req: GatewayRequest): Promise<ClientResponseStream> {
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

Утилиты для работы с `ClientResponseStream`:

```ts
import type { ClientResponseStream, StreamItem, ClientResponse } from "../types.js";

// Transform each item in stream
export async function* mapStream(
  stream: ClientResponseStream,
  fn: (item: StreamItem) => StreamItem,
): ClientResponseStream {
  for await (const item of stream) {
    yield fn(item);
  }
}

// Wrap stream with error handling
// Catches both sync errors (stream creation) and async errors (mid-stream)
export async function* catchStream(
  factory: () => ClientResponseStream,
  onError: (error: unknown) => ClientResponse,
): ClientResponseStream {
  let stream: ClientResponseStream;
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
export function final(response: ClientResponse): ClientResponseStream {
  async function* gen(): ClientResponseStream {
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

export interface CommandExecutionContext {
  requestId: string;
  identity: UserIdentity;
  role: UserRole;
}
```

**Изменение сигнатур команд (будущая миграция):**

```ts
// Было
handler?: (args: string[], telegramId: number) => Promise<ClientResponse>;
streamingHandler?: (args: string[], telegramId: number) => ClientResponseStream;

// Станет
handler?: (args: string[], ctx: CommandExecutionContext) => Promise<ClientResponse>;
streamingHandler?: (args: string[], ctx: CommandExecutionContext) => ClientResponseStream;
```

**Преимущества:**
- Роль доступна в handler (не нужно запрашивать повторно)
- Transport-agnostic (работает для Telegram и HTTP)
- requestId для логирования/трейсинга
- Легко расширять контекст

---

### 8. Request Handlers

Отдельные handlers для каждого типа запроса.

#### 8.1 TelegramMessageHandler

**Файл:** `src/presentation/protocol/gateway/handlers/TelegramMessageHandler.ts`

```ts
import type { RequestHandler, GatewayRequest } from "../types.js";
import type { GatewayContext } from "../GatewayContext.js";
import type { CommandRegistry, CommandExecutionContext } from "../../../commands/types.js";
import type { ClientResponseStream } from "../../types.js";
import { final } from "../stream.js";
import { hasRequiredRole } from "../../../../domain/models/AuthorizedUser.js";
import { routeCommandStreaming } from "../../../commands/router.js";

export class TelegramMessageHandler implements RequestHandler<"telegram-message"> {
  readonly kind = "telegram-message";

  constructor(private readonly registry: CommandRegistry) {}

  async handle(
    req: Extract<GatewayRequest, { kind: "telegram-message" }>,
    ctx: GatewayContext,
  ): Promise<ClientResponseStream> {
    const text = req.text.trim();

    if (!text.startsWith("/")) {
      return final({ text: "Unknown command. Use /help to see available commands." });
    }

    const parts = text.split(/\s+/);
    const commandName = parts[0].slice(1).toLowerCase();
    const args = parts.slice(1);

    const cmd = this.registry.getCommand(commandName);
    if (!cmd) {
      return final({ text: `Unknown command: ${parts[0]}\nUse /help to see available commands.` });
    }

    const role = ctx.getRole();
    if (cmd.requiredRole && !hasRequiredRole(role, cmd.requiredRole)) {
      return final({ text: `Unknown command: ${parts[0]}\nUse /help to see available commands.` });
    }

    const execCtx: CommandExecutionContext = {
      requestId: ctx.requestId,
      identity: req.identity,
      role,
    };

    return routeCommandStreaming(cmd, args, execCtx);
  }
}
```

#### 8.2 TelegramCallbackHandler

**Файл:** `src/presentation/protocol/gateway/handlers/TelegramCallbackHandler.ts`

```ts
import type { RequestHandler, GatewayRequest } from "../types.js";
import type { GatewayContext } from "../GatewayContext.js";
import type { CommandRegistry, CommandExecutionContext } from "../../../commands/types.js";
import type { ClientResponseStream } from "../../types.js";
import { final } from "../stream.js";
import { hasRequiredRole } from "../../../../domain/models/AuthorizedUser.js";
import { findCallbackByPath } from "../../../commands/router.js";

export class TelegramCallbackHandler implements RequestHandler<"telegram-callback"> {
  readonly kind = "telegram-callback";

  constructor(private readonly registry: CommandRegistry) {}

  async handle(
    req: Extract<GatewayRequest, { kind: "telegram-callback" }>,
    ctx: GatewayContext,
  ): Promise<ClientResponseStream> {
    const result = findCallbackByPath(this.registry.getCommands(), req.callbackData);
    if (!result) {
      return final({ text: "Unknown action." });
    }

    const role = ctx.getRole();
    if (result.requiredRole && !hasRequiredRole(role, result.requiredRole)) {
      return final({ text: "Unknown action." });
    }

    const execCtx: CommandExecutionContext = {
      requestId: ctx.requestId,
      identity: req.identity,
      role,
    };

    const response = await result.handler(execCtx);
    return final(response);
  }
}
```

#### 8.3 HttpRequestHandler

**Файл:** `src/presentation/protocol/gateway/handlers/HttpRequestHandler.ts`

```ts
import type { RequestHandler, GatewayRequest } from "../types.js";
import type { GatewayContext } from "../GatewayContext.js";
import type { ClientResponseStream } from "../../types.js";
import { final } from "../stream.js";

export class HttpRequestHandler implements RequestHandler<"http-request"> {
  readonly kind = "http-request";

  async handle(
    req: Extract<GatewayRequest, { kind: "http-request" }>,
    ctx: GatewayContext,
  ): Promise<ClientResponseStream> {
    // TBD: реализация после исследования HTTP server
    return final({ text: "HTTP handler not implemented" });
  }
}
```

---

### 9. GatewayCore

**Файл:** `src/presentation/protocol/gateway/GatewayCore.ts`

Dispatcher — только маршрутизация на handlers:

```ts
import type { GatewayHandler, GatewayRequest, RequestHandler } from "./types.js";
import type { GatewayContext } from "./GatewayContext.js";
import type { ClientResponseStream } from "../types.js";
import { final } from "./stream.js";

export class GatewayCore implements GatewayHandler {
  private readonly handlers: Map<string, RequestHandler<any>>;

  constructor(handlers: RequestHandler<any>[]) {
    this.handlers = new Map(handlers.map(h => [h.kind, h]));
  }

  async handle(req: GatewayRequest, ctx: GatewayContext): Promise<ClientResponseStream> {
    const handler = this.handlers.get(req.kind);
    if (!handler) {
      return final({ text: "Unknown request type" });
    }
    return handler.handle(req as any, ctx);
  }
}
```

**Пример создания:**
```ts
const core = new GatewayCore([
  new TelegramMessageHandler(registry),
  new TelegramCallbackHandler(registry),
  new HttpRequestHandler(),
]);
```

**Ответственности GatewayCore:**
- Только dispatch по `kind` на соответствующий handler
- Не содержит бизнес-логики

**Что делают handlers:**
- `TelegramMessageHandler` — parse команды, lookup, masking, routing
- `TelegramCallbackHandler` — lookup callback, masking, execute
- `HttpRequestHandler` — TBD

**Что НЕ делает GatewayCore и handlers:**
- Загрузка роли (делает plugin LoadRolePlugin)
- Rate limiting (делает plugin RateLimitPlugin)
- Error handling (делает plugin ErrorBoundaryPlugin)
- Валидация callbackData (делает plugin CallbackValidationPlugin)

---

### 10. Plugin Example (для понимания структуры)

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

### 11. Exports

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
- [ ] `GatewayRequest` — три kind: `telegram-message`, `telegram-callback`, `http-request`
- [ ] `ClientResponse`, `ClientResponseStream`, `StreamItem` — переименованы из UI-типов
- [ ] `GatewayHandler` — интерфейс с методом `handle()`
- [ ] `GatewayPlugin` — интерфейс с методом `apply()`
- [ ] `GatewayContext` — класс с `getRole()` / `setRole()`, создаётся внутри Gateway
- [ ] `Gateway` — применяет plugins через `reduceRight`, создаёт context внутри `handle()`
- [ ] `RequestHandler<K>` — интерфейс для типизированных handlers
- [ ] `TelegramMessageHandler`, `TelegramCallbackHandler`, `HttpRequestHandler` — отдельные handlers
- [ ] `GatewayCore` — только dispatch, реализует `GatewayHandler`
- [ ] Stream utilities работают (`mapStream`, `catchStream`, `final`)
- [ ] `CommandExecutionContext` добавлен в `commands/types.ts`
- [ ] Все файлы компилируются без ошибок
- [ ] Нет интеграции (Telegram/HTTP адаптеры не затронуты)

## Open Questions for PM

1. **HTTP server исследование** — текущая реализация HttpServer и handlers (SecretPageHandler, ImportPageHandler) требует анализа для определения:
   - Структура `http-request` в GatewayRequest
   - Нужна ли авторизация через роли или только token-based?
   - Как интегрировать с Gateway (или оставить отдельно?)
2. **HTTP sessionId** — какой формат идентификатора для HTTP клиентов? (token, session id, API key?)
3. **Приоритет следующих итераций:**
   - Плагины (ErrorBoundaryPlugin, LoadRolePlugin, RateLimitPlugin)?
   - Интеграция с Telegram?
   - Исследование и интеграция HTTP?
   - Миграция команд?
4. **Rate limiting** — требования к лимитам? (requests per minute, per user, global?)

## References

- `src/presentation/protocol/ProtocolHandler.ts` — текущая реализация
- `src/presentation/protocol/types.ts` — UI streaming contract
- `src/presentation/commands/router.ts` — command routing
- `src/presentation/commands/types.ts` — command types
- `src/presentation/telegram/TelegramAdapter.ts` — Telegram adapter
- `src/infrastructure/shared/http/HttpServer.ts` — HTTP server
- `src/domain/models/AuthorizedUser.ts` — UserRole
