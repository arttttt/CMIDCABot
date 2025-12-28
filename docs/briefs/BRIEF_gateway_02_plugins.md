# Brief: Gateway Plugins

## Problem Statement

Gateway Core реализован, но для интеграции с TelegramAdapter необходимы плагины:
- Загрузка роли пользователя в `GatewayContext`
- Обработка ошибок с user-friendly сообщениями

Дополнительно: `AuthorizationHelper` содержит дублирующуюся логику получения роли и привязан к `telegramId`. Нужен transport-agnostic use case.

## Proposed Solution

1. **GetUserRoleUseCase** — новый use case для получения роли по `UserIdentity`
2. **LoadRolePlugin** — загружает роль в context через use case
3. **ErrorBoundaryPlugin** — оборачивает ошибки через `StreamUtils.catch`
4. **RoleGuard** — композиция для проверки доступа в handlers
5. **ClientResponse class** — рефакторинг interface → class для явного создания
6. **Deprecation plan** для `AuthorizationHelper.getRole()`

## Technical Context

### Существующие компоненты
- `src/presentation/protocol/gateway/` — Gateway Core (реализован)
- `src/presentation/protocol/gateway/types.ts` — `GatewayPlugin`, `GatewayHandler`
- `src/presentation/protocol/gateway/stream.ts` — `StreamUtils.catch`
- `src/presentation/protocol/gateway/GatewayContext.ts` — `setRole()`, `getRole()`
- `src/domain/helpers/AuthorizationHelper.ts` — текущая логика (будет deprecated)
- `src/domain/repositories/AuthRepository.ts` — интерфейс репозитория
- `src/domain/models/UserIdentity.ts` — transport-agnostic identity

### Зависимости
- `LoadRolePlugin` → `GetUserRoleUseCase` → `AuthRepository`
- `ErrorBoundaryPlugin` → `StreamUtils.catch`

## Scope

### Включено
- `GetUserRoleUseCase` — use case в domain
- `LoadRolePlugin` — плагин
- `ErrorBoundaryPlugin` — плагин
- `RoleGuard` — utility class для проверки доступа
- `ClientResponse` — рефакторинг interface → class
- Deprecation аннотации для `AuthorizationHelper.getRole()`

### Исключено
- Интеграция с TelegramAdapter (следующая итерация)
- RateLimitPlugin (отложено)
- CallbackValidationPlugin (отложено)
- Полный рефакторинг AuthorizationHelper

## File Structure

```
src/
├── domain/
│   └── usecases/
│       ├── GetUserRoleUseCase.ts       # NEW
│       └── index.ts                     # + export
│
└── presentation/
    └── protocol/
        ├── types.ts                     # UPDATE - ClientResponse interface → class
        └── gateway/
            ├── plugins/
            │   ├── LoadRolePlugin.ts    # NEW
            │   ├── ErrorBoundaryPlugin.ts # NEW
            │   └── index.ts             # NEW
            ├── RoleGuard.ts             # NEW
            ├── handlers/
            │   ├── TelegramMessageHandler.ts  # UPDATE - use RoleGuard
            │   └── TelegramCallbackHandler.ts # UPDATE - use RoleGuard
            └── index.ts                 # + export plugins, RoleGuard
```

---

## Technical Specification

### 1. GetUserRoleUseCase

**Файл:** `src/domain/usecases/GetUserRoleUseCase.ts`

Use case для получения роли пользователя по `UserIdentity`:

```ts
import type { AuthRepository } from "../repositories/AuthRepository.js";
import type { UserIdentity } from "../models/UserIdentity.js";
import type { UserRole } from "../models/AuthorizedUser.js";

export class GetUserRoleUseCase {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly ownerTelegramId: number,
  ) {}

  async execute(identity: UserIdentity): Promise<UserRole> {
    if (identity.provider === "telegram") {
      // Owner is always "owner" role
      if (identity.telegramId === this.ownerTelegramId) {
        return "owner";
      }

      const user = await this.authRepository.getById(identity.telegramId);
      return user?.role ?? "guest";
    }

    // HTTP identity — future implementation
    // For now, return "guest" (no authorization)
    return "guest";
  }
}
```

**Контракт:**
- Принимает `UserIdentity` (transport-agnostic)
- Возвращает `UserRole` (никогда undefined)
- Fallback на `"guest"` для неизвестных пользователей
- Owner определяется по `ownerTelegramId` из конфига

**Отличие от AuthorizationHelper.getRole():**
| Аспект | AuthorizationHelper | GetUserRoleUseCase |
|--------|--------------------|--------------------|
| Input | `telegramId: number` | `UserIdentity` |
| Output | `UserRole \| undefined` | `UserRole` (always defined) |
| Fallback | Caller handles undefined | Built-in "guest" fallback |
| Location | domain/helpers | domain/usecases |

---

### 2. LoadRolePlugin

**Файл:** `src/presentation/protocol/gateway/plugins/LoadRolePlugin.ts`

Плагин загружает роль и сохраняет в context:

```ts
import type { GatewayPlugin, GatewayHandler, GatewayRequest } from "../types.js";
import type { GatewayContext } from "../GatewayContext.js";
import type { ClientResponseStream } from "../../types.js";
import type { GetUserRoleUseCase } from "../../../../domain/usecases/GetUserRoleUseCase.js";

class LoadRoleHandler implements GatewayHandler {
  constructor(
    private readonly getUserRole: GetUserRoleUseCase,
    private readonly next: GatewayHandler,
  ) {}

  async handle(req: GatewayRequest, ctx: GatewayContext): Promise<ClientResponseStream> {
    const role = await this.getUserRole.execute(req.identity);
    ctx.setRole(role);
    return this.next.handle(req, ctx);
  }
}

export class LoadRolePlugin implements GatewayPlugin {
  constructor(private readonly getUserRole: GetUserRoleUseCase) {}

  apply(next: GatewayHandler): GatewayHandler {
    return new LoadRoleHandler(this.getUserRole, next);
  }
}
```

**Принцип работы:**
1. Получает `identity` из request
2. Вызывает `GetUserRoleUseCase.execute(identity)`
3. Сохраняет роль через `ctx.setRole(role)`
4. Передаёт управление следующему handler

**Позиция в цепочке:**
- После `ErrorBoundaryPlugin` (чтобы ошибки загрузки роли были пойманы)
- Перед `GatewayCore` (чтобы handlers имели доступ к роли)

---

### 3. ErrorBoundaryPlugin

**Файл:** `src/presentation/protocol/gateway/plugins/ErrorBoundaryPlugin.ts`

Плагин оборачивает ошибки:

```ts
import type { GatewayPlugin, GatewayHandler, GatewayRequest } from "../types.js";
import type { GatewayContext } from "../GatewayContext.js";
import type { ClientResponseStream, ClientResponse } from "../../types.js";
import { StreamUtils } from "../stream.js";
import { logger } from "../../../../infrastructure/shared/logging/index.js";

class ErrorBoundaryHandler implements GatewayHandler {
  constructor(private readonly next: GatewayHandler) {}

  async handle(req: GatewayRequest, ctx: GatewayContext): Promise<ClientResponseStream> {
    return StreamUtils.catch(
      () => this.next.handle(req, ctx),
      (error) => this.handleError(error, ctx),
    );
  }

  private handleError(error: unknown, ctx: GatewayContext): ClientResponse {
    const message = error instanceof Error ? error.message : String(error);

    logger.error("Gateway", "Unhandled error", {
      requestId: ctx.requestId,
      error: message,
    });

    return {
      text: "An error occurred. Please try again later.",
    };
  }
}

export class ErrorBoundaryPlugin implements GatewayPlugin {
  apply(next: GatewayHandler): GatewayHandler {
    return new ErrorBoundaryHandler(next);
  }
}
```

**Принцип работы:**
1. Оборачивает вызов `next.handle()` в `StreamUtils.catch`
2. Ловит sync и async ошибки
3. Логирует с `requestId` для трейсинга
4. Возвращает user-friendly сообщение

**Позиция в цепочке:**
- Первый плагин (outermost wrapper)
- Ловит все ошибки из всей цепочки

---

### 4. RoleGuard

**Файл:** `src/presentation/protocol/gateway/RoleGuard.ts`

Utility class для проверки доступа — убирает дублирование в handlers:

```ts
import type { GatewayContext } from "./GatewayContext.js";
import type { UserRole } from "../../../domain/models/AuthorizedUser.js";
import { hasRequiredRole } from "../../../domain/models/AuthorizedUser.js";

export class RoleGuard {
  /**
   * Check if user has access to resource with required role.
   *
   * @param ctx - Gateway context with user role
   * @param requiredRole - Required role for the resource (undefined = no restriction)
   * @returns true if access is granted, false if denied
   */
  static canAccess(ctx: GatewayContext, requiredRole: UserRole | undefined): boolean {
    return !requiredRole || hasRequiredRole(ctx.getRole(), requiredRole);
  }
}
```

**Использование в TelegramMessageHandler:**
```ts
// Before
const role = ctx.getRole();
if (cmd.requiredRole && !hasRequiredRole(role, cmd.requiredRole)) {
  return StreamUtils.final({ text: GatewayMessages.UNKNOWN_COMMAND });
}

// After
if (!RoleGuard.canAccess(ctx, cmd.requiredRole)) {
  return StreamUtils.final({ text: GatewayMessages.UNKNOWN_COMMAND });
}
```

**Использование в TelegramCallbackHandler:**
```ts
// Before
const role = ctx.getRole();
if (result.requiredRole && !hasRequiredRole(role, result.requiredRole)) {
  return StreamUtils.final({ text: GatewayMessages.UNKNOWN_ACTION });
}

// After
if (!RoleGuard.canAccess(ctx, result.requiredRole)) {
  return StreamUtils.final({ text: GatewayMessages.UNKNOWN_ACTION });
}
```

**Преимущества:**
- Единая точка проверки доступа
- Guard только проверяет, handler решает что делать с результатом
- Чистое разделение ответственностей
- Легко тестировать (pure function)
- Статические методы — нет необходимости создавать instance

---

### 5. ClientResponse Class

**Файл:** `src/presentation/protocol/types.ts`

Рефакторинг `ClientResponse` из interface в class для явного создания:

```ts
/**
 * Button for inline keyboards
 */
export interface ClientButton {
  text: string;
  callbackData?: string;
  url?: string;
}

/**
 * Unified client response format
 */
export class ClientResponse {
  constructor(
    public readonly text: string,
    public readonly buttons?: ClientButton[][],
    public readonly deleteUserMessage?: boolean,
  ) {}
}
```

**Использование:**
```ts
// Before (object literal)
return { text: "An error occurred. Please try again later." };

// After (explicit class instantiation)
return new ClientResponse("An error occurred. Please try again later.");

// With buttons
return new ClientResponse(
  "Choose an option:",
  [[{ text: "OK", callbackData: "ok" }]],
);

// With deleteUserMessage
return new ClientResponse(
  "Private key exported",
  undefined,
  true,
);
```

**Преимущества:**
- Явное создание — видно что создаётся response
- Консистентно с другими языками (Kotlin, Java)
- `instanceof` проверки работают
- Иммутабельность через `readonly`

**Обратная совместимость:**
- Существующий код с литералами `{ text: "..." }` нужно обновить
- Все места создания `ClientResponse` требуют миграции на `new ClientResponse(...)`

---

### 6. Plugin Exports

**Файл:** `src/presentation/protocol/gateway/plugins/index.ts`

```ts
export { LoadRolePlugin } from "./LoadRolePlugin.js";
export { ErrorBoundaryPlugin } from "./ErrorBoundaryPlugin.js";
```

**Обновить:** `src/presentation/protocol/gateway/index.ts`

```ts
// ... existing exports ...

// Plugins
export * from "./plugins/index.js";
```

---

### 7. Deprecation AuthorizationHelper.getRole()

**Файл:** `src/domain/helpers/AuthorizationHelper.ts`

Добавить JSDoc deprecation:

```ts
/**
 * Get user's role
 * @deprecated Use GetUserRoleUseCase instead. This method will be removed in future versions.
 */
async getRole(telegramId: number): Promise<UserRole | undefined> {
  // existing implementation
}
```

**План миграции:**

| Использование | Файл | Действие |
|---------------|------|----------|
| ProtocolHandler | `presentation/protocol/ProtocolHandler.ts` | Будет заменён на Gateway |
| /start command | `presentation/commands/handlers.ts:649` | Миграция на `CommandExecutionContext.role` |
| AddAuthorizedUserUseCase | `domain/usecases/` | Использует `isAdmin()` — отдельный рефакторинг |
| UpdateUserRoleUseCase | `domain/usecases/` | Использует `isAdmin()` — отдельный рефакторинг |

**Примечание:** Полный рефакторинг `AuthorizationHelper` — отдельная задача. В этой итерации только deprecation `getRole()`.

---

## Plugin Chain Order

Порядок плагинов при создании Gateway:

```ts
const gateway = new Gateway(core, [
  new ErrorBoundaryPlugin(),      // 1. Outermost - catches all errors
  new LoadRolePlugin(getUserRole), // 2. Loads role into context
  // future: RateLimitPlugin
  // future: CallbackValidationPlugin
]);
```

**Порядок выполнения при запросе:**
```
Request → ErrorBoundary → LoadRole → GatewayCore → Handlers
                                          ↓
Response ← ErrorBoundary ← LoadRole ← GatewayCore ← Handlers
```

---

## Acceptance Criteria

- [ ] `GetUserRoleUseCase` создан в `domain/usecases/`
- [ ] `GetUserRoleUseCase` принимает `UserIdentity`, возвращает `UserRole`
- [ ] `GetUserRoleUseCase` корректно определяет owner по `ownerTelegramId`
- [ ] `GetUserRoleUseCase` возвращает `"guest"` для неизвестных пользователей
- [ ] `LoadRolePlugin` использует `GetUserRoleUseCase`
- [ ] `LoadRolePlugin` вызывает `ctx.setRole()` перед next handler
- [ ] `ErrorBoundaryPlugin` использует `StreamUtils.catch`
- [ ] `ErrorBoundaryPlugin` логирует ошибки с `requestId`
- [ ] `ErrorBoundaryPlugin` возвращает user-friendly сообщение
- [ ] `RoleGuard.canAccess()` возвращает boolean
- [ ] `TelegramMessageHandler` использует `RoleGuard.canAccess()`
- [ ] `TelegramCallbackHandler` использует `RoleGuard.canAccess()`
- [ ] `ClientResponse` — class вместо interface
- [ ] `ClientResponse` — конструктор с `text`, `buttons?`, `deleteUserMessage?`
- [ ] Все места создания `ClientResponse` мигрированы на `new ClientResponse(...)`
- [ ] Плагины экспортируются из `gateway/plugins/index.ts`
- [ ] `RoleGuard` экспортируется из `gateway/index.ts`
- [ ] `AuthorizationHelper.getRole()` помечен как `@deprecated`
- [ ] Все файлы компилируются без ошибок
- [ ] Нет интеграции с TelegramAdapter (отдельная задача)

## Open Questions for PM

1. **Сообщение об ошибке** — "An error occurred. Please try again later." подходит? Или нужен другой текст?
2. **HTTP identity** — текущая реализация возвращает `"guest"`. Это ок для MVP или нужна заглушка с TODO?
3. **Следующая итерация** — интеграция с TelegramAdapter или миграция команд на `CommandExecutionContext`?

## References

- `src/presentation/protocol/gateway/` — Gateway Core
- `src/domain/helpers/AuthorizationHelper.ts` — текущая логика
- `src/domain/repositories/AuthRepository.ts` — репозиторий
- `src/domain/models/UserIdentity.ts` — identity type
- `docs/briefs/BRIEF_gateway_01_core.md` — предыдущий бриф
