# Brief: Валидация Telegram Callback Data (SEC-03)

## Problem Statement

В `TelegramAdapter.ts` callback data из inline-кнопок не проходит валидацию перед обработкой. Данные проверяются только на совпадение с известными значениями (`delete_sensitive`, `mnemonic_saved`), после чего произвольные данные передаются в `handler.handleCallback()`.

**Риски:**
- Injection через malformed callback data
- Неожиданное поведение при обработке некорректных данных
- Отсутствие логирования подозрительных запросов (fuzzing, атаки)

**Дополнительная находка:** Обработчики `delete_sensitive` и `mnemonic_saved` — мёртвый код. В проекте нет кнопок, создающих эти callback (все кнопки используют `url`, не `callbackData`).

## Proposed Solution

1. Удалить мёртвый код — обработчики `delete_sensitive` и `mnemonic_saved`
2. Добавить валидацию всех callback data перед обработкой:
   - Проверка длины (≤64 символа — ограничение Telegram)
   - Проверка формата по regex
   - Логирование невалидных данных
   - Возврат "Unknown action" при невалидных данных

## Technical Context

### Текущий flow обработки callback

```
Telegram → bot.on("callback_query:data")
         → TelegramAdapter проверяет специальные значения
         → handler.handleCallback(ctx)
         → ProtocolHandler.handleCallback()
         → findCallbackByPath() ищет handler в дереве команд
         → возвращает UIResponse
```

### Ожидаемый формат callback data

Из `src/presentation/commands/router.ts:145`:
```
path/to/command:action
```

Примеры:
- `wallet:show`
- `wallet/export:confirm`
- `admin/invite:create`

### Мёртвый код (подтверждено анализом)

Строки 252-296 в `TelegramAdapter.ts`:
- `delete_sensitive` — обработчик есть, но кнопка нигде не создаётся
- `mnemonic_saved` — обработчик есть, но кнопка нигде не создаётся

Все кнопки в проекте используют `url` (внешние ссылки), а не `callbackData`.

### Текущее безопасное поведение

При неизвестном callback `findCallbackByPath()` возвращает `undefined`, и пользователь видит "Unknown action." — это безопасно, но:
- Нет логирования подозрительных запросов
- Нет защиты от слишком длинных строк
- Мёртвый код усложняет понимание системы

## Suggested Approach

### Шаг 1: Удалить мёртвый код

Удалить строки 252-296 в `TelegramAdapter.ts` (обработчики `delete_sensitive` и `mnemonic_saved`).

### Шаг 2: Добавить валидатор callback data

Константы валидации:
```typescript
// Illustrative snippet — not implementation
const CALLBACK_MAX_LENGTH = 64;
const CALLBACK_PATTERN = /^[a-z][a-z0-9_]*(\/[a-z][a-z0-9_]*)*:[a-z][a-z0-9_]*$/;
```

### Шаг 3: Валидация перед обработкой

Логика валидации в обработчике `callback_query:data`:
1. Проверить длину `callbackData.length <= 64`
2. Проверить формат `CALLBACK_PATTERN.test(callbackData)`
3. При невалидных данных:
   - Логировать с `userId` (для аудита)
   - Вызвать `ctx.answerCallbackQuery()`
   - Вернуться без вызова `handleCallback()`

### Архитектурное соответствие

Согласно `prompts/ARCHITECTURE.md`:
- Валидация остаётся в adapter (thin adapter, но input validation — его ответственность)
- Логирование через `infrastructure/shared/logging`
- Не добавляем бизнес-логику в adapter

## Open Questions for PM

1. **Логирование:** Какой уровень логирования для невалидных callback — `warn` или `info`?
2. **Rate limiting:** Нужно ли ограничивать частоту невалидных callback от одного пользователя?
3. **Метрики:** Нужно ли отслеживать количество невалидных callback для мониторинга?

## References

- `src/presentation/telegram/TelegramAdapter.ts` — основной файл для изменений (строки 249-311)
- `src/presentation/protocol/ProtocolHandler.ts:188` — `handleCallback()` метод
- `src/presentation/commands/router.ts:141` — `findCallbackByPath()` функция
- `src/presentation/protocol/types.ts:61` — `UICallbackContext` интерфейс
- `prompts/ARCHITECTURE.md` — архитектурные принципы (thin adapters)
