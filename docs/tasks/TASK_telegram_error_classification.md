# Task: Классификация ошибок в TelegramAdapter

## Context

Глобальный error handler (`bot.catch`) отправляет одинаковое сообщение для всех ошибок. Пользователь не понимает, стоит ли повторить попытку или проблема постоянная.

## Acceptance Criteria

- [ ] Ошибки классифицируются по типам: network, rate limit (429), server error (5xx), bad request (400), forbidden (403), unknown
- [ ] Для каждого типа отправляется специфичное сообщение (на английском):
  - Network: "Connection issues. Please try again."
  - Rate limit: "Too many requests. Please wait a moment."
  - Server error: "Service temporarily unavailable. Please try again later."
  - Bad request / Unknown: "An error occurred. Please try again later." (generic)
- [ ] Для 403 Forbidden сообщение НЕ отправляется (бот заблокирован — отправка невозможна)
- [ ] Решение работает как с polling, так и с webhook режимами
- [ ] Уровень логирования остаётся `error` для всех типов

## Scope

- Классификатор ошибок grammY (GrammyError, HttpError)
- Обновление `bot.catch` в TelegramAdapter
- User-friendly сообщения без технических деталей

## Out of Scope

- Дополнительный retry в `bot.catch` (уже есть в `handleStreamingResponse`)
- Метрики / счётчики ошибок
- Изменение уровней логирования

## Technical Notes

- Создать `src/infrastructure/shared/resilience/TelegramErrors.ts` с классификатором
- grammY экспортирует `GrammyError` (HTTP ошибки API) и `HttpError` (сетевые)
- `GrammyError.error_code` содержит HTTP status code
- Существующий `isRateLimitError` в `Retry.ts` можно использовать как референс

## Open Questions

Нет — все вопросы закрыты.
