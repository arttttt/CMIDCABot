# Brief: Улучшение обработки ошибок в TelegramAdapter

## Problem Statement

Глобальный error handler (`bot.catch`) в `TelegramAdapter.ts` обрабатывает все ошибки одинаково:
- Нет различия между типами ошибок (network, rate limit, server error, client error)
- Generic сообщение не помогает пользователю понять, что делать
- Технические детали не раскрываются (это правильно), но и полезной информации нет

Это снижает UX: пользователь не понимает, стоит ли повторить попытку или проблема на его стороне.

## Proposed Solution

Добавить классификацию ошибок и специфичные user-friendly сообщения без раскрытия технических деталей.

## Technical Context

### Текущая реализация
Файл: `src/presentation/telegram/TelegramAdapter.ts`, строки 310-329

```typescript
bot.catch(async (err: BotError<Context>) => {
  const message = err.error instanceof Error ? err.error.message : "Unknown error";
  logger.error("TelegramBot", "Bot error", { error: message });
  // ... отправка generic сообщения
});
```

### Существующая инфраструктура
- `src/infrastructure/shared/resilience/Retry.ts` — уже есть `withRetry`, `tryWithRetry`, `isRateLimitError`
- `tryWithRetry` уже используется внутри `handleStreamingResponse` для retry отправки сообщений
- Решение должно работать как с **polling**, так и с **webhook** режимами (bot.catch работает одинаково для обоих)

### Типы ошибок grammY
- `GrammyError` — ошибки Telegram API (содержит HTTP status code)
- `HttpError` — сетевые ошибки при запросах
- Стандартные `Error` — ошибки бизнес-логики

## Suggested Approach

### 1. Создать классификатор ошибок
Файл: `src/infrastructure/shared/resilience/TelegramErrors.ts`

Классификация:
| Тип ошибки | HTTP код | Recoverable | Сообщение пользователю |
|------------|----------|-------------|------------------------|
| Network error | — | Да | "Connection issues. Please try again." |
| Rate Limit | 429 | Да | "Too many requests. Please wait a moment." |
| Server Error | 5xx | Да | "Service temporarily unavailable." |
| Bad Request | 400 | Нет | Generic message |
| Forbidden | 403 | Нет | Не отправлять (бот заблокирован) |
| Unknown | — | Нет | Generic message |

### 2. Обновить bot.catch
- Классифицировать ошибку через новую utility-функцию
- Выбрать соответствующее сообщение
- Для 403 (Forbidden) — не пытаться отправить сообщение

### 3. Не добавлять дополнительный retry
- Retry уже реализован в `handleStreamingResponse` через `tryWithRetry`
- `bot.catch` — последний рубеж обработки, только классификация + сообщение

## Open Questions for PM

1. **Язык сообщений**: бот сейчас на английском — оставляем английские сообщения об ошибках?
2. **Логирование**: нужно ли различать уровни логирования (warn для recoverable, error для non-recoverable)?
3. **Метрики**: нужно ли добавить счётчики ошибок по типам для мониторинга?

## References

- `src/presentation/telegram/TelegramAdapter.ts` — текущая реализация
- `src/infrastructure/shared/resilience/Retry.ts` — существующие retry utilities
- [grammY Error Handling](https://grammy.dev/guide/errors.html) — документация grammY
