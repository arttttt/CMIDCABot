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
| `OWNER_TELEGRAM_ID` | Yes | - | Telegram ID of the bot owner (super admin) |
| `MASTER_ENCRYPTION_KEY` | Yes | - | Master key for private key encryption (base64, 32 bytes) |
| `SOLANA_RPC_URL` | No | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `DB_MODE` | No | `sqlite` | Database mode (`sqlite` \| `memory`) |
| `DATABASE_PATH` | No | `./data/bot.db` | Path to SQLite database |
| `AUTH_DATABASE_PATH` | No | `./data/auth.db` | Path to authorization database |
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

### Authorization Setup

The bot uses a role-based access control system. You must set the owner's Telegram ID:

```env
OWNER_TELEGRAM_ID=123456789
```

To get your Telegram ID, you can use bots like [@userinfobot](https://t.me/userinfobot).

## User Roles

The bot has three user roles with different permissions:

| Role | Description | Permissions |
|------|-------------|-------------|
| **Owner** | Bot owner (set via `OWNER_TELEGRAM_ID`) | Full access, cannot be modified or removed |
| **Admin** | Administrator added by owner | Can manage users (add/remove/change role), but not other admins |
| **User** | Regular authorized user | Access to bot commands based on mode |

Role hierarchy: `owner` > `admin` > `user`

- Owner can manage admins and users
- Admin can only manage users
- Users cannot manage anyone

## Running

### Development mode

```bash
npm run dev
```

In development mode (`NODE_ENV=development`):
- Debug logging for all incoming messages
- Webhook is automatically deleted to enable polling
- Hot-reload enabled via tsx
- All commands available (portfolio, dca, prices, swap, admin)

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

In production mode (`NODE_ENV=production`):
- Only wallet and admin commands available
- DCA, portfolio, prices, and swap commands are disabled

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

### Production mode

| Command | Role | Description |
|---------|------|-------------|
| `/wallet` | user | Show current wallet info |
| `/wallet create` | user | Create new wallet |
| `/wallet import <key>` | user | Import wallet from private key |
| `/wallet export` | user | Export private key |
| `/wallet delete` | user | Delete wallet |
| `/admin` | admin | Show admin help |
| `/admin add <id> [role]` | admin | Add authorized user (default role: user) |
| `/admin remove <id>` | admin | Remove authorized user |
| `/admin list` | admin | List all authorized users |
| `/admin role <id> <role>` | admin | Change user role |

### Development mode (all production commands plus)

| Command | Role | Description |
|---------|------|-------------|
| `/dca` | user | Show DCA status |
| `/dca start` | user | Start DCA automation |
| `/dca stop` | user | Stop DCA automation |
| `/portfolio` | user | Portfolio status |
| `/portfolio buy <amount>` | user | Purchase asset using DCA strategy |
| `/prices` | user | Show current asset prices |
| `/swap` | user | Show swap usage |
| `/swap quote <amount> [asset]` | user | Get swap quote (default: SOL) |
| `/swap simulate <amount> [asset]` | user | Simulate swap without executing |
| `/swap execute <amount> [asset]` | user | Execute real swap on Solana |

## Tech stack

- **TypeScript** 5.9
- **grammY** — Telegram Bot Framework
- **@solana/web3.js** v2 — Solana SDK
- **better-sqlite3** + **Kysely** — Local database with type-safe query builder
- **tsx** — Run TypeScript without compilation

## License

MIT
