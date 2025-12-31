<!-- GitHub Issue: #176 -->
# BRIEF: Команда /help для Gateway

## Контекст

После миграции на Gateway команда `/help` перестала работать. В `ProtocolHandler` она была hardcoded, а в Gateway — должна быть обычной командой в registry.

## Текущее состояние

- `/help` не зарегистрирована в `definitions.ts`
- `TelegramMessageHandler` ищет команду в registry → не находит → "Unknown command"
- `HelpFormatter` существует и готов к использованию
- `GatewayContext` хранит роль пользователя

## Требования

### Функциональные
1. `/help` показывает список команд, доступных текущему пользователю
2. Фильтрация по роли — пользователь видит только команды, соответствующие его `requiredRole`
3. Отображение modeInfo (dev/prod) как раньше

### Нефункциональные
1. Команда регистрируется в registry как обычная команда
2. Единообразие с остальными командами
3. Без hardcode в handlers

## Решение: Вариант A — HelpCommand как обычная команда

### Проблема циклической зависимости

```
Registry → HelpCommand → Registry (цикл)
```

### Решение: Lazy injection через Factory

При создании registry передаём getter:

```typescript
// handlers.ts
export interface HelpCommandDeps {
  helpFormatter: HelpFormatter;
  getRegistry: () => CommandRegistry;  // lazy getter
}

export function createHelpCommand(deps: HelpCommandDeps): Command {
  return {
    definition: Definitions.help,
    handler: async (args, telegramId) => {
      const registry = deps.getRegistry();
      const commands = registry.getCommands();
      const modeInfo = registry.getModeInfo();
      // TODO: фильтрация по роли — см. "Открытый вопрос"
      return new ClientResponse(deps.helpFormatter.formatHelp(commands, modeInfo));
    },
  };
}
```

```typescript
// DevCommandRegistry.ts
constructor(deps: DevCommandRegistryDeps) {
  // Создаём help с lazy getter
  const helpCommand = createHelpCommand({
    helpFormatter: deps.help.helpFormatter,
    getRegistry: () => this,  // ссылка на себя
  });

  this.commands = new Map([
    ["help", helpCommand],
    ["start", createStartCommand(deps.start)],
    // ...
  ]);
}
```

## Открытый вопрос: Фильтрация по роли

### Проблема
`CommandHandler` имеет сигнатуру `(args, telegramId)` — нет доступа к роли.

### Варианты решения

| Вариант | Описание | Плюсы | Минусы |
|---------|----------|-------|--------|
| **A1. Передать роль через args** | `args[0] = role` (внутренний протокол) | Быстро | Хак, нарушает контракт |
| **A2. Добавить CommandExecutionContext** | Миграция сигнатуры handler | Правильно | Большой scope |
| **A3. Показывать все команды** | Без фильтрации по роли | Просто | Нарушает текущее поведение |
| **A4. Загружать роль в handler** | `GetUserRoleUseCase` внутри help | Дублирование | Работает без миграции |

### Рекомендация

**A4** — прагматичное решение без большого рефакторинга:

```typescript
export interface HelpCommandDeps {
  helpFormatter: HelpFormatter;
  getRegistry: () => CommandRegistry;
  getUserRole: GetUserRoleUseCase;
}

handler: async (args, telegramId) => {
  const registry = deps.getRegistry();
  const role = await deps.getUserRole.execute({ telegramId });
  const allCommands = registry.getCommands();
  const filtered = filterCommandsByRole(allCommands, role);
  const modeInfo = registry.getModeInfo();
  return new ClientResponse(deps.helpFormatter.formatHelp(filtered, modeInfo));
}
```

Дублирование загрузки роли (уже загружена в `LoadRolePlugin`) — но это изолированный случай.

## Зависимости

- `HelpFormatter` — существует
- `GetUserRoleUseCase` — существует
- `RoleGuard.canAccess()` — для фильтрации
- `CommandRegistry` — интерфейс не меняется

## Файлы для изменения

1. `src/presentation/commands/definitions.ts` — добавить `help`
2. `src/presentation/commands/handlers.ts` — добавить `createHelpCommand`
3. `src/presentation/commands/DevCommandRegistry.ts` — зарегистрировать help
4. `src/presentation/commands/ProdCommandRegistry.ts` — зарегистрировать help

## Риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Дублирование загрузки роли | Низкий | Изолировано в одной команде |
| Забыть обновить ProdCommandRegistry | Средний | Добавить в чеклист |

## Альтернативы (отклонены)

- **Hardcode в TelegramMessageHandler** — нарушает принцип единообразия
- **HelpPlugin** — избыточная сложность для одной команды

## Scope

### Включено
- Регистрация `/help` в обоих registry
- Фильтрация по роли
- Отображение modeInfo

### Исключено
- Миграция на `CommandExecutionContext` (отдельная задача)
- Изменение формата вывода

## Следующий шаг

Создать TASK для реализации.
