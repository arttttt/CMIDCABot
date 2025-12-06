# DCATgBot

Telegram bot for automated DCA (Dollar Cost Averaging) investing in cryptocurrencies on Solana.

Implements the "Healthy Crypto Index" strategy — a basket of three assets:
- **BTC (cbBTC)** — 40%
- **ETH** — 30%
- **SOL** — 30%

On each purchase, the bot selects the asset whose portfolio share lags furthest behind its target allocation.

## Requirements

- Node.js >= 24.0.0 (LTS)
- npm >= 10.0.0

## Installation

```bash
git clone https://github.com/arttttt/DCATgBot.git
cd DCATgBot
npm install
```

## Configuration

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Fill in the variables:

```env
# Environment (development | production)
NODE_ENV=development

# Telegram Bot (get from @BotFather)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet

# Database
DATABASE_PATH=./data/bot.db
```

## Running

### Development mode

```bash
npm run dev
```

In development mode (`NODE_ENV=development`):
- Debug logging for all incoming messages
- Webhook is automatically deleted to enable polling
- Hot-reload enabled via tsx

### Web test interface

For testing without Telegram, use the web interface:

```bash
npm run dev:web
```

Then open http://localhost:3000 in your browser. The web interface provides:
- Chat-like UI that mimics Telegram
- Quick command buttons for testing
- No Telegram token required

You can also enable it via environment variable:
```env
WEB_ENABLED=true
WEB_PORT=3000  # optional, default 3000
```

### Production

```bash
npm run build
npm start
```

## Build

```bash
npm run build
```

Compiled files will appear in the `dist/` directory.

## Type checking

```bash
npx tsc --noEmit
```

## Bot commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and command list |
| `/help` | Strategy description |
| `/status` | Portfolio status |
| `/balance` | Check balances |

## Tech stack

- **TypeScript** 5.9
- **grammY** — Telegram Bot Framework
- **@solana/web3.js** v2 — Solana SDK
- **better-sqlite3** — Local database
- **tsx** — Run TypeScript without compilation

## Devnet

This project runs on Solana Devnet only. To get test SOL:

1. Go to [Solana Faucet](https://faucet.solana.com/)
2. Enter your wallet address
3. Request test tokens

## License

MIT
