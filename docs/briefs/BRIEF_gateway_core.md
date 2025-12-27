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
