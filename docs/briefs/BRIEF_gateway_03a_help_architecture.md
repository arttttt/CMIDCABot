# Brief: Gateway Help Command Architecture

## Problem Statement

Команда `/help` в `ProtocolHandler` (строки 95-98, 131-137) имеет специфические требования:
- Доступ к `CommandRegistry` для получения списка команд
- Доступ к `UserRole` для фильтрации команд по `hasRequiredRole`
- Доступ к `ModeInfo` для отображения режима

Текущие сигнатуры `CommandHandler` и `StreamingCommandHandler` не предоставляют этих данных:
```typescript
type CommandHandler = (args: string[], telegramId: number) => Promise<ClientResponse>;
type StreamingCommandHandler = (args: string[], telegramId: number) => ClientResponseStream;
```

При переносе `/help` из ProtocolHandler в Gateway архитектуру, нужен механизм для передачи этих зависимостей.

## Proposed Solution

**Гибридный подход: closure для dependencies + context для runtime данных.**

1. **Добавить `contextHandler`** в Command interface (опционально, рядом с `handler`)
2. **Обновить router** для поддержки `contextHandler`
3. **Определить паттерн** для system commands (help, start) с lazy registry access
4. **НЕ реализовывать** саму команду help (это этап 3e)

Разделение ответственностей:
- **Dependencies** (registry, formatters) -> через closure в фабричной функции
- **Runtime context** (role, identity, requestId) -> через `CommandExecutionContext`

## Technical Context

### Существующие компоненты
- `src/presentation/commands/types.ts` - `Command`, `CommandHandler`, `CommandExecutionContext`
- `src/presentation/commands/router.ts` - `routeCommand`, `routeCommandStreaming`
- `src/presentation/commands/handlers.ts` - фабричные функции команд
- `src/presentation/commands/DevCommandRegistry.ts` - registry с pattern `create*Command(deps)`
- `src/presentation/protocol/gateway/handlers/TelegramMessageHandler.ts` - вызывает router
- `src/presentation/formatters/HelpFormatter.ts` - форматирование help

### Текущий паттерн создания команд
```typescript
// handlers.ts
export function createWalletCommand(deps: WalletCommandDeps): Command { ... }

// DevCommandRegistry.ts
this.commands = new Map([
  ["wallet", createWalletCommand(deps.wallet)],
  ...
]);
```

### CommandExecutionContext (уже определен, не используется)
```typescript
export interface CommandExecutionContext {
  requestId: string;
  identity: UserIdentity;
  role: UserRole;
}
```

## Scope

### Included
- Добавление `contextHandler` в `Command` interface
- Обновление `routeCommand` и `routeCommandStreaming` для поддержки context
- Определение типа `ContextAwareCommandHandler`
- Определение интерфейса `HelpCommandDeps` (паттерн для system commands)

### Excluded
- Реализация команды `/help` (этап 3e)
- Реализация команды `/start` с context (отдельная задача)
- Миграция существующих команд на contextHandler
- Удаление legacy `handler` из interface

## Key Decisions

| Вопрос | Решение | Обоснование |
|--------|---------|-------------|
| Как передать registry в help? | Lazy access: `getRegistry: () => CommandRegistry` | Решает циклическую зависимость registry -> help -> registry |
| Как передать role в handler? | Через `CommandExecutionContext.role` | Роль уже загружена в GatewayContext, не нужно повторно запрашивать |
| Новый тип handler? | `contextHandler` опционально рядом с `handler` | Обратная совместимость, постепенная миграция |
| Router fallback | Если есть `contextHandler` - использовать его, иначе legacy `handler` | Не ломает существующие команды |
| ModeInfo | Через `getRegistry().getModeInfo()` | Уже часть CommandRegistry interface |

## Technical Specification

### 1. ContextAwareCommandHandler

**Файл:** `src/presentation/commands/types.ts`

Новый тип handler с доступом к context:

```typescript
/**
 * Context-aware command handler
 *
 * Handler that receives CommandExecutionContext with role, identity, requestId.
 * Use for commands that need access to user role or other context data.
 */
export type ContextAwareCommandHandler = (
  args: string[],
  ctx: CommandExecutionContext,
) => Promise<ClientResponse>;

/**
 * Streaming context-aware command handler
 */
export type ContextAwareStreamingHandler = (
  args: string[],
  ctx: CommandExecutionContext,
) => ClientResponseStream;
```

### 2. Command Interface Extension

**Файл:** `src/presentation/commands/types.ts`

Добавить опциональные context handlers:

```typescript
export interface Command {
  definition: CommandDefinition;
  requiredRole?: UserRole;

  // Legacy handlers (telegramId)
  handler?: CommandHandler;
  streamingHandler?: StreamingCommandHandler;

  // Context-aware handlers (CommandExecutionContext)
  // If present, take precedence over legacy handlers
  contextHandler?: ContextAwareCommandHandler;
  contextStreamingHandler?: ContextAwareStreamingHandler;

  subcommands?: Map<string, Command>;
  callbacks?: Map<string, CallbackHandler>;
}
```

**Приоритет:**
1. `contextStreamingHandler` (если есть)
2. `contextHandler` (если есть)
3. `streamingHandler` (legacy)
4. `handler` (legacy)

### 3. Router Updates

**Файл:** `src/presentation/commands/router.ts`

Обновить функции для поддержки context:

```typescript
/**
 * Route command with streaming support
 *
 * Priority:
 * 1. contextStreamingHandler (if present)
 * 2. contextHandler (wrapped in stream)
 * 3. streamingHandler (legacy)
 * 4. handler (legacy, wrapped in stream)
 */
export async function* routeCommandStreaming(
  cmd: Command,
  args: string[],
  ctx: CommandExecutionContext,
): ClientResponseStream {
  const { command, args: finalArgs } = findTargetCommand(cmd, args);

  // Prefer context-aware streaming handler
  if (command.contextStreamingHandler) {
    yield* command.contextStreamingHandler(finalArgs, ctx);
    return;
  }

  // Context-aware handler wrapped in stream
  if (command.contextHandler) {
    const response = await command.contextHandler(finalArgs, ctx);
    yield { response, mode: "final" };
    return;
  }

  // Legacy streaming handler (backward compatibility)
  if (command.streamingHandler) {
    const telegramId = ctx.identity.provider === "telegram"
      ? ctx.identity.telegramId
      : 0; // HTTP clients - TBD
    yield* command.streamingHandler(finalArgs, telegramId);
    return;
  }

  // Legacy handler
  if (command.handler) {
    const telegramId = ctx.identity.provider === "telegram"
      ? ctx.identity.telegramId
      : 0;
    const response = await command.handler(finalArgs, telegramId);
    yield { response, mode: "final" };
    return;
  }

  yield {
    response: new ClientResponse("Unknown subcommand. Use /help for available commands."),
    mode: "final",
  };
}
```

### 4. TelegramMessageHandler Update

**Файл:** `src/presentation/protocol/gateway/handlers/TelegramMessageHandler.ts`

Создавать `CommandExecutionContext` и передавать в router:

```typescript
async handle(
  req: Extract<GatewayRequest, { kind: "telegram-message" }>,
  ctx: GatewayContext,
): Promise<ClientResponseStream> {
  // ... parsing logic ...

  const cmd = this.registry.getCommand(commandName);
  if (!cmd) {
    return StreamUtils.final(new ClientResponse(GatewayMessages.UNKNOWN_COMMAND));
  }

  if (!RoleGuard.canAccess(ctx.getRole(), cmd.requiredRole)) {
    return StreamUtils.final(new ClientResponse(GatewayMessages.UNKNOWN_COMMAND));
  }

  // Create execution context
  const execCtx: CommandExecutionContext = {
    requestId: ctx.requestId,
    identity: req.identity,
    role: ctx.getRole(),
  };

  return routeCommandStreaming(cmd, args, execCtx);
}
```

### 5. HelpCommandDeps Pattern

**Файл:** `src/presentation/commands/types.ts`

Паттерн для system commands с lazy registry access:

```typescript
/**
 * Dependencies for help command
 *
 * Uses lazy registry access to avoid circular dependency:
 * Registry creates help command, help command needs registry.
 */
export interface HelpCommandDeps {
  /** Lazy getter - called at execution time, not creation time */
  getRegistry: () => CommandRegistry;
  helpFormatter: HelpFormatter;
}
```

**Использование (этап 3e):**
```typescript
// handlers.ts
export function createHelpCommand(deps: HelpCommandDeps): Command {
  return {
    definition: { name: "help", description: "Show available commands" },
    contextHandler: async (args, ctx) => {
      const registry = deps.getRegistry();
      const commands = registry.getCommands();
      const modeInfo = registry.getModeInfo();
      const filtered = filterCommandsByRole(commands, ctx.role);
      return new ClientResponse(deps.helpFormatter.formatHelp(filtered, modeInfo));
    },
  };
}

// DevCommandRegistry.ts
constructor(deps: DevCommandRegistryDeps) {
  this.commands = new Map([
    ["help", createHelpCommand({
      getRegistry: () => this,
      helpFormatter: new HelpFormatter(),
    })],
    // ...
  ]);
}
```

---

## File Structure

```
src/presentation/
├── commands/
│   ├── types.ts              # UPDATE: + ContextAwareCommandHandler, HelpCommandDeps
│   └── router.ts             # UPDATE: routeCommandStreaming accepts ctx
│
└── protocol/gateway/
    └── handlers/
        ├── TelegramMessageHandler.ts   # UPDATE: create execCtx
        └── TelegramCallbackHandler.ts  # UPDATE: create execCtx (if needed)
```

---

## Alternatives Considered

### A) Closure-only (без context)

```typescript
function createHelpCommand(registry: CommandRegistry): Command {
  return {
    handler: async (args, telegramId) => {
      // registry доступен через closure
      // Но role недоступна! Нужно запрашивать заново
      const role = await authHelper.getRole(telegramId);
      // ...
    }
  };
}
```

**Минусы:**
- Дублирование запроса роли (уже загружена в GatewayContext)
- authHelper нужно передавать в каждую команду которой нужна роль
- Нет доступа к requestId для логирования

### B) Context-only (все через context)

```typescript
interface CommandExecutionContext {
  requestId: string;
  identity: UserIdentity;
  role: UserRole;
  registry: CommandRegistry;  // Добавить!
}
```

**Минусы:**
- Смешивание runtime данных и configuration
- Registry одинаковый для всех запросов - зачем передавать каждый раз?
- Усложняет интерфейс для обычных команд которым registry не нужен

### C) Help как plugin

```typescript
class HelpPlugin implements GatewayPlugin {
  apply(next: GatewayHandler): GatewayHandler {
    return {
      handle: async (req, ctx) => {
        if (isHelpCommand(req)) {
          return this.handleHelp(req, ctx);
        }
        return next.handle(req, ctx);
      }
    };
  }
}
```

**Минусы:**
- Специальная обработка вне command tree
- Не отображается в registry.getCommands()
- Нарушает единообразие

### D) Выбранный подход: Hybrid (closure + context)

**Плюсы:**
- Dependencies (registry) через closure - конфигурация при создании
- Runtime данные (role) через context - актуальные данные
- Обратная совместимость через fallback на legacy handlers
- Постепенная миграция
- Единообразный command tree

**Минусы:**
- Два типа handlers в interface
- Дополнительная сложность в router

---

## Acceptance Criteria

- [ ] `ContextAwareCommandHandler` тип добавлен в `types.ts`
- [ ] `ContextAwareStreamingHandler` тип добавлен в `types.ts`
- [ ] `Command` interface расширен полями `contextHandler` и `contextStreamingHandler`
- [ ] `HelpCommandDeps` интерфейс добавлен в `types.ts`
- [ ] `routeCommandStreaming` принимает `CommandExecutionContext` вместо `telegramId`
- [ ] `routeCommandStreaming` проверяет context handlers с приоритетом над legacy
- [ ] `routeCommand` обновлён аналогично (если используется)
- [ ] `TelegramMessageHandler` создаёт `CommandExecutionContext` и передаёт в router
- [ ] `TelegramCallbackHandler` обновлён аналогично
- [ ] Все файлы компилируются без ошибок
- [ ] Существующие команды продолжают работать (backward compatibility)
- [ ] НЕ реализована команда help (это этап 3e)

## Open Questions for PM

1. **Callback handlers** - нужно ли добавить context-aware версию `CallbackHandler`? Текущий:
   ```typescript
   type CallbackHandler = (telegramId: number) => Promise<ClientResponse>;
   ```

2. **HTTP identity fallback** - что использовать вместо `telegramId` для HTTP клиентов в legacy handlers? Текущее решение: `0` с TODO.

3. **Миграция существующих команд** - когда планировать? После интеграции Gateway с TelegramAdapter или раньше?

## References

- `/home/user/CMIDCABot/src/presentation/commands/types.ts` - Command types
- `/home/user/CMIDCABot/src/presentation/commands/router.ts` - Command routing
- `/home/user/CMIDCABot/src/presentation/commands/handlers.ts` - Command factories
- `/home/user/CMIDCABot/src/presentation/commands/DevCommandRegistry.ts` - Registry example
- `/home/user/CMIDCABot/src/presentation/protocol/ProtocolHandler.ts` - Current /help logic (lines 95-98, 131-137)
- `/home/user/CMIDCABot/src/presentation/protocol/gateway/handlers/TelegramMessageHandler.ts` - Gateway handler
- `/home/user/CMIDCABot/src/presentation/formatters/HelpFormatter.ts` - Help formatting
- `/home/user/CMIDCABot/docs/briefs/BRIEF_gateway_01_core.md` - Gateway Core brief
- `/home/user/CMIDCABot/docs/briefs/BRIEF_gateway_02_plugins.md` - Gateway Plugins brief
