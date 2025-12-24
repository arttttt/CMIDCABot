# Brief: Zod-валидация переменных окружения

## Problem Statement

Текущая валидация env variables в `AppConfig.ts` фрагментарна и ненадёжна:

| Переменная | Статус |
|------------|--------|
| `JUPITER_API_KEY` | Не проверяется наличие при `PRICE_SOURCE=jupiter` |
| `PUBLIC_URL` | Не проверяется формат URL |
| `WEBHOOK_URL` | Не проверяется HTTPS при `BOT_TRANSPORT=webhook` |
| `DB_MODE`, `PRICE_SOURCE`, `BOT_TRANSPORT` | Каст к enum без проверки валидности |
| `DCA_AMOUNT_USDC` | `parseFloat` может вернуть `NaN` |
| `MASTER_ENCRYPTION_KEY` | Не проверяется base64 / длина |

**Риск:** Бот может стартовать с невалидной конфигурацией и упасть позже в рантайме с непонятной ошибкой.

## Proposed Solution

Заменить ad-hoc валидацию на централизованную zod-схему. При старте приложения `process.env` валидируется целиком, при ошибке — понятное сообщение и exit(1).

## Technical Context

- **Текущая реализация:** `src/infrastructure/shared/config/AppConfig.ts` — функция `loadConfig()` с ручными проверками
- **Типы:** `src/types/config.ts` — интерфейсы `Config`, `DatabaseMode`, `PriceSource`, `TransportMode`
- **Зависимость:** zod (~15KB, zero dependencies)
- **Существующие паттерны:** Уже есть проверка HTTPS для `SOLANA_RPC_URL` и блокировка forbidden vars в production

## Suggested Approach

1. **Добавить zod** — `npm install zod`

2. **Создать схему** — новый файл `src/infrastructure/shared/config/envSchema.ts`:
   - Определить zod-схему для всех env variables
   - Использовать `.refine()` для условных проверок (например, `JUPITER_API_KEY` required при `PRICE_SOURCE=jupiter`)
   - Использовать `.transform()` для преобразования типов (string → number)

3. **Рефакторинг loadConfig():**
   - Валидировать `process.env` через схему
   - Убрать дублирующие ручные проверки
   - Сохранить логику forbidden vars в production

4. **Вывести типы из схемы** — `z.infer<typeof envSchema>` вместо ручного `Config` интерфейса (опционально)

### Правила валидации

| Переменная | Правило |
|------------|---------|
| `PUBLIC_URL` | `.url()` — валидный URL |
| `WEBHOOK_URL` | `.url().startsWith("https://")` при `BOT_TRANSPORT=webhook` |
| `JUPITER_API_KEY` | Required при `PRICE_SOURCE=jupiter` |
| `DB_MODE` | `.enum(["sqlite", "memory"])` |
| `PRICE_SOURCE` | `.enum(["jupiter", "mock"])` |
| `BOT_TRANSPORT` | `.enum(["polling", "webhook"])` |
| `DCA_AMOUNT_USDC` | `.coerce.number().positive()` |
| `MASTER_ENCRYPTION_KEY` | `.regex(/^[A-Za-z0-9+/=]{43,44}$/)` — base64 32 bytes |
| `OWNER_TELEGRAM_ID` | `.coerce.number().int().positive()` |

## Open Questions for PM

1. **Строгость для JUPITER_API_KEY:** Блокировать старт или только warning при отсутствии ключа с `PRICE_SOURCE=jupiter`?

2. **MASTER_ENCRYPTION_KEY формат:** Проверять только regex или декодировать и проверять длину 32 байта?

3. **Обратная совместимость типов:** Выводить `Config` из zod-схемы (`z.infer`) или сохранить существующие интерфейсы в `types/config.ts`?

4. **Уровень детализации ошибок:** Показывать все ошибки сразу или останавливаться на первой?

## References

- `src/infrastructure/shared/config/AppConfig.ts` — текущая реализация
- `src/types/config.ts` — типы конфигурации
- `.env.example` — список всех переменных
- [Zod documentation](https://zod.dev/)
