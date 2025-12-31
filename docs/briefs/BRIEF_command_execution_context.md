<!-- GitHub Issue: #184 -->
# BRIEF: Command Execution Context Migration

## TL;DR

Миграция команд с `(args, telegramId)` на `(args, CommandExecutionContext)`.
Устранение дублирования запросов role. 25 хендлеров, 5 файлов.

## Контекст

- `CommandExecutionContext` определён как interface, не используется
- Команды получают только `telegramId`, role запрашивается повторно в `/start` и `/help`
- Gateway уже загружает role в `LoadRolePlugin`, но не передаёт в команды

## Проблема

Role загружается дважды:
1. `LoadRolePlugin` → `ctx.setRole(role)`
2. `/start`: `authHelper.getRole(telegramId)`
3. `/help`: `getUserRole.execute({ telegramId })`

Команды не имеют доступа к данным из Gateway (role, requestId, identity).

## Scope

### Включено

- `CommandExecutionContext`: interface → class
- Новые сигнатуры `CommandHandler`, `StreamingCommandHandler`, `CallbackHandler`
- Миграция всех 25 хендлеров
- Создание контекста в `TelegramMessageHandler` / `TelegramCallbackHandler`
- Устранение дублирования role в `/start` и `/help`

### Исключено

- Изменение `GatewayContext`
- Новые команды
- Тесты

## Технические детали

### CommandExecutionContext (class)

```typescript
class CommandExecutionContext {
  constructor(
    readonly requestId: string,
    readonly identity: UserIdentity,
    readonly role: UserRole,
  ) {}

  // Геттер для удобства миграции
  get telegramId(): number {
    return this.identity.telegramId;
  }
}
```

### Новые сигнатуры

```typescript
type CommandHandler = (args: string[], ctx: CommandExecutionContext) => Promise<ClientResponse>;
type StreamingCommandHandler = (args: string[], ctx: CommandExecutionContext) => ClientResponseStream;
type CallbackHandler = (ctx: CommandExecutionContext) => Promise<ClientResponse>;
```

### Создание контекста (TelegramMessageHandler)

```typescript
const ctx = new CommandExecutionContext(
  gatewayCtx.requestId,
  req.identity,
  gatewayCtx.getRole(),
);
```

### Затронутые файлы (5)

| Файл | Изменения |
|------|-----------|
| `types.ts` | Класс `CommandExecutionContext`, новые сигнатуры |
| `handlers.ts` | 25 хендлеров: `telegramId` → `ctx.telegramId` или `ctx.identity.telegramId` |
| `router.ts` | `routeCommand`, `routeCommandStreaming` — принимают `ctx` |
| `TelegramMessageHandler.ts` | Создание `CommandExecutionContext` |
| `TelegramCallbackHandler.ts` | Создание `CommandExecutionContext` |

### Устранение дублирования role

| Команда | Было | Станет |
|---------|------|--------|
| `/start` | `authHelper.getRole(telegramId)` | `ctx.role` |
| `/help` | `getUserRole.execute({ telegramId })` | `ctx.role` |

### Единственный источник данных

После миграции:
- `telegramId` — только из `ctx.telegramId` или `ctx.identity.telegramId`
- `role` — только из `ctx.role`
- `requestId` — только из `ctx.requestId`
- `identity` — только из `ctx.identity`

Альтернативные пути получения этих данных должны быть удалены.

## Порядок миграции

1. `types.ts` — класс `CommandExecutionContext`, новые сигнатуры
2. `router.ts` — `routeCommand`, `routeCommandStreaming` принимают `ctx`
3. `handlers.ts` — команды по группам:
   - Простые (prices, version) — не используют telegramId
   - wallet, dca, portfolio — `telegramId` → `ctx.telegramId`
   - swap, admin — `telegramId` → `ctx.telegramId`
   - start — убрать `authHelper.getRole()`, использовать `ctx.role`
   - help — убрать `getUserRole.execute()`, использовать `ctx.role`
4. `TelegramMessageHandler.ts` — создание контекста
5. `TelegramCallbackHandler.ts` — создание контекста

## Зависимости

- `GatewayContext` — источник `requestId`, `role`
- `GatewayRequest` — источник `identity`
- `UserIdentity`, `UserRole` — типы из domain

## Риски

| Риск | Уровень | Митигация |
|------|---------|-----------|
| 25 точек изменения | Средний | Поэтапная миграция, проверка компиляции |
| Нет тестов | Средний | Ручное тестирование после миграции |
| Пропуск альтернативного пути | Низкий | Grep по `getRole`, `getUserRole` после миграции |

## Acceptance Criteria

- [ ] `CommandExecutionContext` — класс с `requestId`, `identity`, `role`, геттером `telegramId`
- [ ] Все команды принимают `ctx` вместо `telegramId`
- [ ] `/start` использует `ctx.role`, вызов `authHelper.getRole()` удалён
- [ ] `/help` использует `ctx.role`, вызов `getUserRole.execute()` удалён
- [ ] Единственный источник `role` — `CommandExecutionContext`
- [ ] Единственный источник `telegramId` — `CommandExecutionContext`
- [ ] Код компилируется
- [ ] Бот запускается и команды работают

## Ссылки

- `src/presentation/commands/types.ts` — текущий интерфейс
- `src/presentation/commands/handlers.ts` — все команды
- `src/presentation/protocol/gateway/handlers/TelegramMessageHandler.ts`
- BRIEF_gateway_02_plugins.md — LoadRolePlugin
