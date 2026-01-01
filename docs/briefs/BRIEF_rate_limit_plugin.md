<!-- GitHub Issue: #187 -->
# RateLimitPlugin — Техническое исследование

## TL;DR

Плагин для защиты от спама. Sliding window алгоритм, in-memory хранилище, лимит по userId.

## Контекст

Gateway поддерживает plugin chain. RateLimitPlugin встраивается между ErrorBoundary и LoadRole для защиты от злоупотреблений до обращения к БД.

## Архитектурные решения

### Алгоритм: Sliding Window Log

| Алгоритм | Плюсы | Минусы |
|----------|-------|--------|
| Fixed Window | Простой | Burst на границе (2x лимит) |
| Token Bucket | Гладкий | Сложнее реализовать |
| **Sliding Window** | Точный, предсказуемый | O(n) память |

**Выбор:** Sliding Window — для Telegram бота нагрузка невысокая, точность важнее.

### Ключ лимитирования

```typescript
function getRateLimitKey(identity: UserIdentity): string {
  return identity.provider === "telegram"
    ? `tg:${identity.telegramId}`
    : `http:${identity.sessionId}`;
}
```

### Хранилище: In-memory

Для single instance на DevNet достаточно. Абстракция `RateLimitStore` позволит заменить на Redis при масштабировании.

## Позиция в цепочке

```
ErrorBoundary → RateLimitPlugin → LoadRole → GatewayCore
```

**Почему перед LoadRole:** защита от DoS до обращения к БД.

## Структура плагина

```typescript
interface RateLimitConfig {
  windowMs: number;      // Окно (60_000 = 1 мин)
  maxRequests: number;   // Лимит запросов
}

class RateLimitStore {
  private requests = new Map<string, number[]>();

  record(key: string, now: number): void;
  countInWindow(key: string, windowStart: number): number;
}

class RateLimitHandler implements GatewayHandler {
  async handle(req, ctx): Promise<ClientResponseStream> {
    const key = getKey(req.identity);
    const count = store.countInWindow(key, ctx.nowMs - windowMs);

    if (count >= maxRequests) {
      return rateLimitExceeded(ctx);
    }

    store.record(key, ctx.nowMs);
    return next.handle(req, ctx);
  }
}
```

## Ответ при превышении

```typescript
return StreamUtils.final(
  new ClientResponse("Слишком много запросов. Подождите немного.")
);
```

Не бросаем ошибку — возвращаем stream напрямую.

## Конфигурация

| Параметр | Значение | Env |
|----------|----------|-----|
| windowMs | 60000 | `RATE_LIMIT_WINDOW_MS` |
| maxRequests | 30 | `RATE_LIMIT_MAX_REQUESTS` |

## Решения

| Вопрос | Решение | Обоснование |
|--------|---------|-------------|
| Лимиты по ролям | Единый для всех | Rate limit — защита инфраструктуры, не привилегия |
| Whitelist owner | Да, по telegramId | Проверка через env без БД: O(1) |
| Сообщение | Generic текст | Без времени до сброса |

### Whitelist реализация

```typescript
// Проверка без обращения к БД
if (req.identity.provider === "telegram" &&
    req.identity.telegramId === this.ownerTelegramId) {
  return this.next.handle(req, ctx); // skip rate limit
}
```

## Зависимости

- `GatewayPlugin` interface
- `GatewayContext.nowMs` для времени
- `UserIdentity` для ключа

## Файлы для создания

```
src/presentation/protocol/gateway/plugins/
├── RateLimitPlugin.ts
└── RateLimitStore.ts
```

## План реализации

1. `RateLimitStore` — класс хранения с очисткой старых записей
2. `RateLimitPlugin` — плагин по образцу LoadRolePlugin
3. Интеграция в `GatewayFactory`
4. Обновить `.env.example`

---

**Следующий шаг:** `/spec rate_limit_plugin` для создания спецификации задачи.
