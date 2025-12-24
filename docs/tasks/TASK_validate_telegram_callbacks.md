# Task: Валидация Telegram Callback Data (SEC-03)

## Context

В `TelegramAdapter.ts` callback data из inline-кнопок не проходит валидацию перед обработкой. Произвольные данные передаются в `handler.handleCallback()` без проверки формата и длины. Это создаёт риски injection-атак и затрудняет аудит безопасности. Дополнительно обнаружен мёртвый код — обработчики для callback, которые никогда не создаются.

## Acceptance Criteria

### Удаление мёртвого кода
- [ ] Удалён обработчик `delete_sensitive` (строки 252-270 в текущей версии)
- [ ] Удалён обработчик `mnemonic_saved` (строки 273-296 в текущей версии)
- [ ] Комментарии к этим обработчикам также удалены

### Валидация формата
- [ ] Callback data проверяется на максимальную длину: ≤64 символа
- [ ] Callback data проверяется на соответствие формату: `path/to/command:action`
- [ ] Допустимые символы в сегментах пути: `a-z`, `0-9`, `_` (начинается с буквы)
- [ ] Допустимые символы в action: `a-z`, `0-9`, `_` (начинается с буквы)
- [ ] Regex паттерн: `^[a-z][a-z0-9_]*(\/[a-z][a-z0-9_]*)*:[a-z][a-z0-9_]*$`

### Обработка невалидных данных
- [ ] При невалидных данных вызывается `ctx.answerCallbackQuery()` (чтобы убрать "loading" у кнопки)
- [ ] При невалидных данных НЕ вызывается `handler.handleCallback()`
- [ ] Пользователю не показывается сообщение об ошибке (silent fail)

### Логирование
- [ ] Невалидные callback логируются с уровнем `warn`
- [ ] Лог содержит: `userId` (telegramId), длину данных, причину отклонения
- [ ] Сами callback data НЕ логируются (могут содержать вредоносный payload)

### Регрессия
- [ ] Валидные callback продолжают работать как раньше
- [ ] При неизвестном (но валидном по формату) callback возвращается "Unknown action."

## Scope

### Включено
- Файл `src/presentation/telegram/TelegramAdapter.ts`
- Удаление мёртвого кода (обработчики `delete_sensitive`, `mnemonic_saved`)
- Добавление inline-валидации в обработчик `callback_query:data`
- Константы валидации (regex, max length) в том же файле

### Изменяемый код
- Обработчик `bot.on("callback_query:data", ...)` — строки 249-311

## Out of Scope

- **WebAdapter** — валидация callback в веб-интерфейсе (отдельная задача при необходимости)
- **Rate limiting** — ограничение частоты невалидных callback от пользователя
- **Метрики/мониторинг** — счётчики невалидных callback
- **Вынесение валидатора** — отдельный класс/модуль для валидации (over-engineering для текущего объёма)
- **Тесты** — если не запрошены явно

## Technical Notes

### Архитектура
- Валидация остаётся в adapter — это input validation на границе системы
- Согласно `ARCHITECTURE.md`: "Thin adapters — Map external input/output to internal protocol only"
- Input validation — ответственность adapter, это не бизнес-логика

### Формат callback data
Ожидаемый формат из `src/presentation/commands/router.ts`:
```
path/to/command:action
```

Примеры валидных callback:
- `wallet:show`
- `wallet/export:confirm`
- `admin/invite:create`
- `portfolio:refresh`

Примеры невалидных callback:
- `<script>alert(1)</script>` — спецсимволы
- `WALLET:SHOW` — uppercase
- `wallet` — нет action
- `wallet:` — пустой action
- `:action` — пустой path
- (строка длиннее 64 символов)

### Существующие зависимости
- `logger` из `infrastructure/shared/logging` — уже импортирован в файле
- `ctx.answerCallbackQuery()` — метод grammY для ответа на callback

### Порядок проверок
1. Проверка длины (быстрая, O(1))
2. Проверка формата regex (медленнее, но только если длина валидна)
3. Вызов `handler.handleCallback()` (только если формат валиден)

## Definition of Done

1. Мёртвый код удалён
2. Невалидные callback отклоняются до вызова `handleCallback()`
3. Валидные callback работают без изменений
4. В логах видны попытки отправки невалидных callback
5. Код проходит `npm run build` без ошибок
6. Код проходит `npm run lint` без ошибок

## References

- Brief: `docs/briefs/BRIEF_validate_telegram_callbacks.md`
- Основной файл: `src/presentation/telegram/TelegramAdapter.ts:249-311`
- Router (формат callback): `src/presentation/commands/router.ts:141-177`
- Protocol handler: `src/presentation/protocol/ProtocolHandler.ts:188-203`
- Архитектура: `prompts/ARCHITECTURE.md`

## Open Questions

Нет — все вопросы из BRIEF решены:
- Уровень логирования: `warn`
- Rate limiting: out of scope
- Метрики: out of scope
