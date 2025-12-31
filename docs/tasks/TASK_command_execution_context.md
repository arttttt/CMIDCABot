<!-- GitHub Issue: #184 -->
# TASK: Command Execution Context Migration

## Context

Commands currently receive only `telegramId` as a parameter, forcing some commands (`/start`, `/help`) to re-fetch user role from the database. The Gateway already loads the role in `LoadRolePlugin`, but this data isn't passed to command handlers. This task migrates all commands to use `CommandExecutionContext` — a class that provides `requestId`, `identity`, `role`, and a convenience `telegramId` getter.

## Acceptance Criteria

- [x] `CommandExecutionContext` class created in separate file `src/presentation/commands/CommandExecutionContext.ts`
- [x] Class has: `requestId: string`, `identity: UserIdentity`, `role: UserRole`, getter `telegramId`
- [x] Type aliases updated: `CommandHandler`, `StreamingCommandHandler`, `CallbackHandler` accept `ctx: CommandExecutionContext`
- [x] `router.ts`: `routeCommand`, `routeCommandStreaming` accept and pass `ctx`
- [x] All 25 handlers migrated: `telegramId` parameter → `ctx.telegramId`
- [x] `/start`: uses `ctx.role`, `authHelper.getRole()` call removed
- [x] `/help`: uses `ctx.role`, `getUserRole.execute()` call removed
- [x] Unused dependencies removed from `/start` and `/help` command definitions
- [x] `TelegramMessageHandler`: creates `CommandExecutionContext` from `GatewayContext` + `GatewayRequest`
- [x] `TelegramCallbackHandler`: creates `CommandExecutionContext` from `GatewayContext` + `GatewayRequest`
- [x] No alternative paths to get `role` or `telegramId` remain in command handlers
- [x] Code compiles without errors
- [ ] Bot starts and all commands work

## Scope

### Included

- New file: `src/presentation/commands/CommandExecutionContext.ts`
- Modified: `src/presentation/commands/types.ts` (type aliases only)
- Modified: `src/presentation/commands/router.ts`
- Modified: `src/presentation/commands/handlers.ts` (all 25 handlers)
- Modified: `src/presentation/protocol/gateway/handlers/TelegramMessageHandler.ts`
- Modified: `src/presentation/protocol/gateway/handlers/TelegramCallbackHandler.ts`

### Out of Scope

- Changes to `GatewayContext`
- New commands
- Unit tests
- Changes to `ProtocolHandler` (deprecated)

## Technical Notes

### CommandExecutionContext class

```typescript
// src/presentation/commands/CommandExecutionContext.ts
import { UserIdentity } from "../../domain/models/UserIdentity.js";
import { UserRole } from "../../domain/models/UserRole.js";

export class CommandExecutionContext {
  constructor(
    readonly requestId: string,
    readonly identity: UserIdentity,
    readonly role: UserRole,
  ) {}

  get telegramId(): number {
    return this.identity.telegramId;
  }
}
```

### Context creation in handlers

```typescript
// TelegramMessageHandler.ts / TelegramCallbackHandler.ts
const execCtx = new CommandExecutionContext(
  ctx.requestId,
  req.identity,
  ctx.getRole(),
);
```

### Migration pattern for handlers

```typescript
// Before
handler: async (args, telegramId) => {
  const result = await useCase.execute(telegramId);
  // ...
}

// After
handler: async (args, ctx) => {
  const result = await useCase.execute(ctx.telegramId);
  // ...
}
```

### Verification after migration

Run grep to ensure no alternative paths remain:
```bash
grep -r "authHelper.getRole" src/presentation/commands/
grep -r "getUserRole.execute" src/presentation/commands/
```

Both should return no results in command handlers.
