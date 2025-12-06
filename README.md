# DCATgBot

Telegram-бот для автоматического DCA-инвестирования в криптовалюты на Solana.

Реализует стратегию "Healthy Crypto Index" — корзину из трёх активов:
- **BTC (cbBTC)** — 40%
- **ETH** — 30%
- **SOL** — 30%

При каждой покупке бот выбирает актив, чья доля в портфеле отстаёт от целевой сильнее всего.

## Требования

- Node.js >= 20.0.0
- npm >= 10.0.0

## Установка

```bash
git clone https://github.com/arttttt/DCATgBot.git
cd DCATgBot
npm install
```

## Конфигурация

Создай файл `.env` на основе примера:

```bash
cp .env.example .env
```

Заполни переменные:

```env
# Telegram Bot (получить у @BotFather)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet

# Database
DATABASE_PATH=./data/bot.db
```

## Запуск

### Режим разработки (с hot-reload)

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## Сборка

```bash
npm run build
```

Собранные файлы появятся в директории `dist/`.

## Проверка типов

```bash
npx tsc --noEmit
```

## Структура проекта

```
src/
├── index.ts           # Точка входа
├── config/
│   └── index.ts       # Загрузка конфигурации из ENV
├── bot/
│   └── index.ts       # Telegram-бот (grammY)
├── services/
│   ├── index.ts       # Экспорт сервисов
│   ├── solana.ts      # Работа с Solana RPC (@solana/web3.js v2)
│   └── jupiter.ts     # Jupiter API для свопов
├── db/
│   └── index.ts       # SQLite (better-sqlite3)
└── types/
    ├── index.ts       # Экспорт типов
    ├── config.ts      # Типы конфигурации
    └── portfolio.ts   # Типы портфеля
```

## Команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Приветствие и список команд |
| `/help` | Описание стратегии |
| `/status` | Статус портфеля |
| `/balance` | Проверка баланса |

## Технологии

- **TypeScript** 5.9
- **grammY** — Telegram Bot Framework
- **@solana/web3.js** v2 — Solana SDK
- **better-sqlite3** — локальная база данных
- **tsx** — запуск TypeScript без компиляции

## Devnet

Проект работает только на Solana Devnet. Для получения тестовых SOL:

1. Перейди на [Solana Faucet](https://faucet.solana.com/)
2. Введи адрес кошелька
3. Получи тестовые токены

## Лицензия

MIT
