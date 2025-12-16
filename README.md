# CMI DCA Bot

Telegram bot for automated DCA (Dollar Cost Averaging) investing in cryptocurrencies on Solana.

Implements the "Crypto Majors Index" strategy — a basket of three assets:
- **BTC (cbBTC)** — 40%
- **ETH** — 30%
- **SOL** — 30%

On each purchase, the bot selects the asset whose portfolio share lags furthest behind its target allocation.

## Requirements

- Node.js >= 24.0.0 (LTS)
- npm >= 10.0.0

## Installation

```bash
git clone https://github.com/arttttt/cmi-dca-bot.git
cd cmi-dca-bot
npm install
```

## Configuration

Create a `.env` file from the example:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment mode (`development` \| `production`) |
| `TELEGRAM_BOT_TOKEN` | Yes* | - | Telegram bot token from @BotFather |
| `MASTER_ENCRYPTION_KEY` | Yes | - | Master key for private key encryption (base64, 32 bytes) |
| `SOLANA_RPC_URL` | No | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `DB_MODE` | No | `sqlite` | Database mode (`sqlite` \| `memory`) |
| `DATABASE_PATH` | No | `./data/bot.db` | Path to SQLite database |
| `MOCK_DATABASE_PATH` | No | `./data/mock.db` | Path to mock database (dev only) |
| `DCA_AMOUNT_USDC` | No | `6` | Purchase amount in USDC equivalent |
| `DCA_INTERVAL_MS` | No | `86400000` | Interval between purchases in ms (24h) |
| `DEV_WALLET_PRIVATE_KEY` | No | - | Base64-encoded private key (dev only) |
| `PRICE_SOURCE` | No | `jupiter` | Price source (`jupiter` \| `mock`) |
| `JUPITER_API_KEY` | Yes** | - | Jupiter API key from portal.jup.ag |
| `WEB_ENABLED` | No | `false` | Enable web test interface |
| `WEB_PORT` | No | `3000` | Port for web interface |

\* Not required if `WEB_ENABLED=true`
\** Required when `PRICE_SOURCE=jupiter`

### Encryption Setup

Private keys are encrypted at rest using AES-256-GCM. You must generate a master encryption key before first run:

```bash
# Generate a secure 32-byte key
openssl rand -base64 32
```

Add this key to your `.env` file:

```env
MASTER_ENCRYPTION_KEY=<your-generated-key>
```

**Important:**
- Keep this key safe — losing it means losing access to all encrypted wallets
- Do not change this key after users have created wallets
- Back up this key securely (e.g., in a password manager or secure vault)

## Running

### Development mode

```bash
npm run dev
```

In development mode (`NODE_ENV=development`):
- Debug logging for all incoming messages
- Webhook is automatically deleted to enable polling
- Hot-reload enabled via tsx
- Additional dev-only commands available

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

### Always available

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and command list |
| `/help` | Strategy description |
| `/wallet` | Show current wallet info |
| `/wallet create` | Create new wallet |
| `/wallet import <key>` | Import wallet from private key |
| `/wallet export` | Export private key |
| `/wallet delete` | Delete wallet |

### Development mode only

| Command | Description |
|---------|-------------|
| `/dca` | Show DCA status |
| `/dca start` | Start DCA automation |
| `/dca stop` | Stop DCA automation |
| `/portfolio` | Portfolio status |
| `/portfolio buy <amount>` | Purchase asset using DCA strategy |
| `/prices` | Show current asset prices |
| `/swap` | Show swap usage |
| `/swap quote <amount> [asset]` | Get swap quote (default: SOL) |
| `/swap simulate <amount> [asset]` | Simulate swap without executing |
| `/swap execute <amount> [asset]` | Execute real swap on Solana |

## Tech stack

- **TypeScript** 5.9
- **grammY** — Telegram Bot Framework
- **@solana/web3.js** v2 — Solana SDK
- **better-sqlite3** + **Kysely** — Local database with type-safe query builder
- **tsx** — Run TypeScript without compilation

## License

MIT
