# Brief: Gateway Factory

## Problem Statement

Gateway и все его компоненты реализованы, но нет единой точки сборки:
- `Gateway`, `GatewayCore`, handlers, plugins — отдельные классы
- Для создания Gateway нужно вручную собирать зависимости
- Нет централизованного места для конфигурации цепочки плагинов

## Proposed Solution

Создать `GatewayFactory` — фабричную функцию для сборки Gateway с зависимостями.

**Паттерн:** Следует существующим фабрикам в проекте (`RepositoryFactory`, `TransportFactory`).

## Technical Context

### Существующие компоненты

- `src/presentation/protocol/gateway/Gateway.ts` — композиция plugins
- `src/presentation/protocol/gateway/GatewayCore.ts` — dispatcher
- `src/presentation/protocol/gateway/handlers/` — TelegramMessageHandler, TelegramCallbackHandler, HttpRequestHandler
- `src/presentation/protocol/gateway/plugins/` — ErrorBoundaryPlugin, LoadRolePlugin
- `src/domain/usecases/GetUserRoleUseCase.ts` — use case для ролей

### Зависимости для сборки Gateway

```
GatewayFactory
├── GetUserRoleUseCase (для LoadRolePlugin)
│   ├── AuthRepository
│   └── ownerTelegramId
├── CommandRegistry (для handlers)
└── → Gateway (output)
```

### Существующий паттерн фабрик

```typescript
// RepositoryFactory.ts
export function createMainRepositories(
  db: Kysely<MainDatabase>,
  encryptionService: KeyEncryptionService,
): MainRepositories { ... }
```

## Scope

### Included

- `GatewayFactoryDeps` интерфейс — входные зависимости
- `createGateway()` функция — сборка Gateway
- Export из `gateway/index.ts`

### Excluded

- Интеграция с TelegramAdapter (этап 3d)
- Рефакторинг TelegramAdapter (этап 3b)
- Streaming logic extraction (этап 3c)

## Key Decisions

| Вопрос | Решение | Обоснование |
|--------|---------|-------------|
| Функция или класс? | Функция `createGateway()` | Паттерн проекта (RepositoryFactory, TransportFactory) |
| Где размещать? | `src/presentation/protocol/gateway/GatewayFactory.ts` | Рядом с Gateway |
| GetUserRoleUseCase | Создаётся внутри фабрики | Инкапсуляция, меньше параметров |
| Порядок плагинов | ErrorBoundary → LoadRole → Core | ErrorBoundary outermost для catch всех ошибок |

## Technical Specification

### 1. GatewayFactoryDeps

**Файл:** `src/presentation/protocol/gateway/GatewayFactory.ts`

```typescript
import type { AuthRepository } from "../../../domain/repositories/AuthRepository.js";
import type { CommandRegistry } from "../../commands/types.js";

/**
 * Dependencies for creating Gateway
 */
export interface GatewayFactoryDeps {
  authRepository: AuthRepository;
  ownerTelegramId: number;
  commandRegistry: CommandRegistry;
}
```

### 2. createGateway Function

**Файл:** `src/presentation/protocol/gateway/GatewayFactory.ts`

```typescript
import { Gateway } from "./Gateway.js";
import { GatewayCore } from "./GatewayCore.js";
import { TelegramMessageHandler } from "./handlers/TelegramMessageHandler.js";
import { TelegramCallbackHandler } from "./handlers/TelegramCallbackHandler.js";
import { HttpRequestHandler } from "./handlers/HttpRequestHandler.js";
import { ErrorBoundaryPlugin } from "./plugins/ErrorBoundaryPlugin.js";
import { LoadRolePlugin } from "./plugins/LoadRolePlugin.js";
import { GetUserRoleUseCase } from "../../../domain/usecases/GetUserRoleUseCase.js";

/**
 * Create configured Gateway instance
 *
 * Assembles Gateway with:
 * - Plugins: ErrorBoundary (outermost), LoadRole
 * - Handlers: TelegramMessage, TelegramCallback, Http
 *
 * Plugin chain order (execution):
 * Request → ErrorBoundary → LoadRole → GatewayCore → Handlers
 */
export function createGateway(deps: GatewayFactoryDeps): Gateway {
  // Create use case for role resolution
  const getUserRole = new GetUserRoleUseCase(
    deps.authRepository,
    deps.ownerTelegramId,
  );

  // Create request handlers
  const handlers = [
    new TelegramMessageHandler(deps.commandRegistry),
    new TelegramCallbackHandler(deps.commandRegistry),
    new HttpRequestHandler(),
  ];

  // Create core dispatcher
  const core = new GatewayCore(handlers);

  // Create plugins (order: first = outermost)
  const plugins = [
    new ErrorBoundaryPlugin(),
    new LoadRolePlugin(getUserRole),
  ];

  return new Gateway(core, plugins);
}
```

### 3. Export

**Файл:** `src/presentation/protocol/gateway/index.ts`

Добавить:

```typescript
// Factory
export { createGateway, type GatewayFactoryDeps } from "./GatewayFactory.js";
```

---

## File Structure

```
src/presentation/protocol/gateway/
├── GatewayFactory.ts    # NEW
├── Gateway.ts
├── GatewayCore.ts
├── GatewayContext.ts
├── types.ts
├── stream.ts
├── messages.ts
├── RoleGuard.ts
├── handlers/
│   ├── TelegramMessageHandler.ts
│   ├── TelegramCallbackHandler.ts
│   └── HttpRequestHandler.ts
├── plugins/
│   ├── ErrorBoundaryPlugin.ts
│   ├── LoadRolePlugin.ts
│   └── index.ts
└── index.ts             # UPDATE: + export factory
```

---

## Acceptance Criteria

- [ ] `GatewayFactoryDeps` интерфейс создан
- [ ] `createGateway()` функция создана
- [ ] Функция создаёт `GetUserRoleUseCase` внутри
- [ ] Функция создаёт handlers: TelegramMessage, TelegramCallback, Http
- [ ] Функция создаёт plugins в правильном порядке: ErrorBoundary, LoadRole
- [ ] Функция возвращает собранный `Gateway`
- [ ] Export добавлен в `gateway/index.ts`
- [ ] Все файлы компилируются без ошибок

## Open Questions for PM

1. **Дополнительные плагины** — нужно ли предусмотреть расширение (массив дополнительных плагинов в deps)?
2. **Логирование** — добавить лог при создании Gateway?

## References

- `src/presentation/protocol/gateway/` — Gateway модуль
- `src/data/factories/RepositoryFactory.ts` — паттерн фабрики
- `src/presentation/telegram/transport/TransportFactory.ts` — паттерн фабрики
- `docs/briefs/BRIEF_gateway_01_core.md` — Gateway Core
- `docs/briefs/BRIEF_gateway_02_plugins.md` — Plugins
