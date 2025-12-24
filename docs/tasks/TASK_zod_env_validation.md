# Task: Zod-валидация переменных окружения

## Context

Текущая валидация env variables в `AppConfig.ts` фрагментарна: часть проверяется, часть — нет. Бот может стартовать с невалидной конфигурацией и упасть в рантайме. Требуется централизованная валидация через zod с выводом типов из схемы.

## Acceptance Criteria

- [ ] Добавлена зависимость `zod`
- [ ] Создан файл `src/infrastructure/shared/config/envSchema.ts` с zod-схемой
- [ ] Все env variables валидируются при старте согласно таблице правил (см. ниже)
- [ ] При невалидной конфигурации: показываются ВСЕ ошибки сразу, затем `process.exit(1)`
- [ ] Типы `Config` и связанные выводятся из zod-схемы (`z.infer`), файл `types/config.ts` удалён или содержит только re-export
- [ ] `loadConfig()` использует схему вместо ручных проверок
- [ ] Логика forbidden vars в production сохранена
- [ ] `.env.example` актуален (без изменений переменных — только валидация)

## Правила валидации

| Переменная | Правило |
|------------|---------|
| `TELEGRAM_BOT_TOKEN` | Required (если `WEB_ENABLED !== true`) |
| `OWNER_TELEGRAM_ID` | `.coerce.number().int().positive()` |
| `MASTER_ENCRYPTION_KEY` | `.regex(/^[A-Za-z0-9+/=]{43,44}$/)` |
| `PUBLIC_URL` | `.url()` |
| `WEBHOOK_URL` | `.url().startsWith("https://")` — required при `BOT_TRANSPORT=webhook` |
| `JUPITER_API_KEY` | Required при `PRICE_SOURCE=jupiter`, блокировать старт |
| `DB_MODE` | `.enum(["sqlite", "memory"])` |
| `PRICE_SOURCE` | `.enum(["jupiter", "mock"])` |
| `BOT_TRANSPORT` | `.enum(["polling", "webhook"])` |
| `DCA_AMOUNT_USDC` | `.coerce.number().positive()` |
| `DCA_INTERVAL_MS` | `.coerce.number().int().positive()` |
| `SOLANA_RPC_URL` | `.url()`, HTTPS required в production |
| `HTTP_PORT`, `WEB_PORT` | `.coerce.number().int().min(1).max(65535)` |

## Scope

- Создание zod-схемы для всех env variables
- Рефакторинг `loadConfig()` на использование схемы
- Миграция типов: `Config` и связанные интерфейсы выводятся из схемы
- Удаление дублирующего кода валидации

## Out of Scope

- Изменение самих переменных окружения
- Изменение бизнес-логики
- Добавление новых env variables
- Тесты (если не запрошены отдельно)

## Technical Notes

- Расположение схемы: `src/infrastructure/shared/config/envSchema.ts`
- Использовать `z.coerce` для автоматического преобразования string → number
- Использовать `.refine()` или `.superRefine()` для условных проверок (JUPITER_API_KEY, WEBHOOK_URL)
- Формат вывода ошибок: zod `.format()` или кастомный форматтер для читаемости
- Сохранить логику очистки `DEV_WALLET_PRIVATE_KEY` из `process.env` после чтения

## Файлы для изменения

| Файл | Действие |
|------|----------|
| `src/infrastructure/shared/config/envSchema.ts` | Создать |
| `src/infrastructure/shared/config/AppConfig.ts` | Рефакторинг |
| `src/infrastructure/shared/config/index.ts` | Обновить экспорты |
| `src/types/config.ts` | Удалить или заменить на re-export из схемы |
| `package.json` | Добавить zod |

## Open Questions

Нет — все вопросы уточнены.
