<!-- GitHub Issue: #187 -->
# RateLimitPlugin — Спецификация

## Контекст

Gateway нуждается в защите от спама и злоупотреблений. Плагин должен ограничивать частоту запросов до обращения к БД (перед LoadRolePlugin), используя sliding window алгоритм.

## Acceptance Criteria

- [x] Создан `RateLimitCache` с методами `checkAndRecord()` (в `data/sources/memory/`)
- [x] Создан `RateLimitPlugin`, реализующий `GatewayPlugin`
- [x] Плагин встроен в цепочку: `ErrorBoundary → RateLimitPlugin → LoadRole`
- [x] Лимит: 30 запросов в минуту (настраивается через env)
- [x] Owner в whitelist — проверка по `OWNER_TELEGRAM_ID` без БД
- [x] При превышении лимита возвращается `ClientResponse` с generic сообщением
- [x] Lazy cleanup старых записей при каждом запросе
- [x] Периодическая очистка неактивных пользователей (раз в 5 минут)
- [x] Логирование `warn` при превышении лимита (requestId, key)
- [x] Обновлён `.env.example` с новыми переменными

## Scope

**Включено:**
- `RateLimitStore` — класс хранения timestamps
- `RateLimitPlugin` — плагин по паттерну LoadRolePlugin
- Интеграция в `GatewayFactory`
- Конфигурация через env

**Исключено:**
- Redis/persistent storage
- Разные лимиты для ролей
- Retry-after в ответе
- Rate limiting для HTTP (только Telegram)

## Technical Notes

### Структура файлов

```
src/domain/repositories/
└── RateLimitRepository.ts       # Интерфейс

src/data/sources/memory/
└── RateLimitCache.ts            # In-memory хранилище

src/data/repositories/memory/
└── InMemoryRateLimitRepository.ts  # Реализация

src/presentation/protocol/gateway/plugins/
├── RateLimitPlugin.ts           # Плагин
└── index.ts                     # Экспорты
```

### Ключ лимитирования

```typescript
const key = identity.provider === "telegram"
  ? `tg:${identity.telegramId}`
  : `http:${identity.sessionId}`;
```

### Whitelist owner

```typescript
if (req.identity.provider === "telegram" &&
    req.identity.telegramId === this.ownerTelegramId) {
  return this.next.handle(req, ctx);
}
```

### Env переменные

```
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=30
```

### Периодическая очистка

Использовать `setInterval` в конструкторе `RateLimitStore`. Очищать записи, где все timestamps старше window.

### Позиция в цепочке (GatewayFactory)

```typescript
const plugins = [
  new ErrorBoundaryPlugin(),
  new RateLimitPlugin(config),  // <-- добавить
  new LoadRolePlugin(getUserRole),
];
```
