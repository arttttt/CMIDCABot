<!-- GitHub Issue: #176 -->
# Task: Команда /help для Gateway

## Context

После миграции на Gateway архитектуру команда `/help` перестала работать. В старом `ProtocolHandler` она была hardcoded, а в Gateway должна быть обычной командой в registry. Это нарушает единообразие: все остальные команды уже работают через registry, а `/help` возвращает "Unknown command".

## Acceptance Criteria

- [x] Команда `/help` зарегистрирована в `DevCommandRegistry`
- [x] Команда `/help` зарегистрирована в `ProdCommandRegistry`
- [x] Команда показывает только команды, доступные текущему пользователю (фильтрация по роли)
- [x] Команда показывает `modeInfo` в dev-режиме (label + description)
- [x] Команда не показывает `modeInfo` в prod-режиме (там `getModeInfo()` возвращает `null`)
- [x] Роль загружается через `GetUserRoleUseCase` внутри handler
- [x] Нет hardcode в handlers — команда обрабатывается через стандартный роутинг
- [x] Циклическая зависимость решена через lazy getter (`getRegistry: () => this`)

## Scope

**Включено:**
- Добавление `help` в `definitions.ts`
- Создание `createHelpCommand` фабрики в `handlers.ts`
- Регистрация в `DevCommandRegistry` и `ProdCommandRegistry`
- Фильтрация команд по роли пользователя
- Использование существующего `HelpFormatter`

**Исключено:**
- Миграция сигнатуры handler на `CommandExecutionContext` (отдельная задача)
- Изменение формата вывода `HelpFormatter`
- Добавление `/help` в BotCommand меню Telegram (не было раньше)

## Technical Notes

### Циклическая зависимость

```
Registry -> HelpCommand -> Registry (цикл)
```

**Решение:** Lazy injection через getter:

```typescript
const helpCommand = createHelpCommand({
  helpFormatter: deps.help.helpFormatter,
  getUserRole: deps.help.getUserRole,
  getRegistry: () => this,  // lazy reference
});
```

### Фильтрация по роли

Используется `RoleGuard.canAccess(userRole, cmd.requiredRole)` для каждой команды.
Роль загружается через `GetUserRoleUseCase.execute({ provider: "telegram", telegramId })`.

**Примечание:** Дублирование загрузки роли (уже загружена в `LoadRolePlugin`) — изолированный случай, исправляется при миграции на `CommandExecutionContext`.

### HelpFormatter

Существующий метод:
```typescript
formatHelp(commands: Map<string, Command>, modeInfo: ModeInfo | null): string
```

Принимает отфильтрованную Map команд.

## Implementation Steps

1. **definitions.ts** — добавить definition для help:
   ```typescript
   help: {
     name: "help",
     description: "Show available commands",
   },
   ```

2. **handlers.ts** — добавить deps interface и factory:
   ```typescript
   export interface HelpCommandDeps {
     helpFormatter: HelpFormatter;
     getUserRole: GetUserRoleUseCase;
     getRegistry: () => CommandRegistry;
   }

   export function createHelpCommand(deps: HelpCommandDeps): Command {
     return {
       definition: Definitions.help,
       requiredRole: "guest",  // доступна всем, включая guest
       handler: async (_args, telegramId) => {
         const role = await deps.getUserRole.execute({
           provider: "telegram",
           telegramId
         });
         const allCommands = deps.getRegistry().getCommands();
         const filtered = filterCommandsByRole(allCommands, role);
         const modeInfo = deps.getRegistry().getModeInfo();
         return { text: deps.helpFormatter.formatHelp(filtered, modeInfo) };
       },
     };
   }

   function filterCommandsByRole(
     commands: Map<string, Command>,
     role: UserRole
   ): Map<string, Command> {
     const filtered = new Map<string, Command>();
     for (const [name, cmd] of commands) {
       if (RoleGuard.canAccess(role, cmd.requiredRole)) {
         filtered.set(name, cmd);
       }
     }
     return filtered;
   }
   ```

3. **DevCommandRegistry.ts** — обновить deps и зарегистрировать:
   - Добавить `help: HelpCommandDeps` в `DevCommandRegistryDeps`
   - В конструкторе создать helpCommand с `getRegistry: () => this`
   - Добавить `["help", helpCommand]` в Map

4. **ProdCommandRegistry.ts** — аналогично:
   - Добавить `help: HelpCommandDeps` в `ProdCommandRegistryDeps`
   - В конструкторе создать helpCommand с `getRegistry: () => this`
   - Добавить `["help", helpCommand]` в Map

5. **DI-контейнер** — передать зависимости при создании registry:
   ```typescript
   help: {
     helpFormatter: /* ... */,
     getUserRole: /* ... */,
     // getRegistry передается в registry constructor
   }
   ```

## Open Questions

1. **Порядок команд в help** — сохранить текущий (порядок вставки в Map) или сортировать алфавитно?
   - Рекомендация: оставить текущий порядок

2. **help для guest** — показывать только `/start` или вообще ничего?
   - Рекомендация: `requiredRole: "guest"` — команда доступна всем, фильтрует список по роли
