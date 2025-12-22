# CMI DCA Bot

Telegram bot for automated DCA (Dollar Cost Averaging) investing in cryptocurrencies on Solana.

Implements the "Crypto Majors Index" strategy — a basket of three assets:
- **BTC (cbBTC)** — 40%
- **ETH (wETH)** — 30%
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
| `BOT_TRANSPORT` | No | `polling` | Transport mode (`polling` \| `webhook`) |
| `WEBHOOK_URL` | Yes*** | - | Public HTTPS URL for webhook |
| `WEBHOOK_SECRET` | No | - | Secret token for webhook validation |
| `HTTP_PORT` | No | `8000` | Port for HTTP server (health checks, secret pages) |
| `HTTP_HOST` | No | `127.0.0.1` | Host for HTTP server (use `0.0.0.0` for containers) |
| `PUBLIC_URL` | Yes | - | Public URL for one-time secret links |

\* Not required if `WEB_ENABLED=true`
\** Required when `PRICE_SOURCE=jupiter`
\*** Required when `BOT_TRANSPORT=webhook`

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

### Secure Secret Delivery

Seed phrases and private keys are delivered via one-time links instead of being sent directly in Telegram chat. This prevents secrets from being stored in chat history.

Configure the public URL for secret links:

```env
PUBLIC_URL=https://your-app.example.com
```

For local development with ngrok:
```env
PUBLIC_URL=https://abc123.ngrok.io
```

**How it works:**
- When creating a wallet, a one-time URL is generated: `{PUBLIC_URL}/secret/{token}`
- The user clicks the link to view their seed phrase
- Link expires after 5 minutes and works only once
- Same mechanism is used for `/wallet export`

**Important:**
- `PUBLIC_URL` is required — the bot will not start without it
- The URL must be publicly accessible (or accessible to the user)
- Secrets are encrypted at rest and decrypted only on access

### Authorization Setup

The bot uses a role-based access control system. You must set the owner's Telegram ID:

```env
OWNER_TELEGRAM_ID=123456789
```

To get your Telegram ID, you can use bots like [@userinfobot](https://t.me/userinfobot).

## User Roles

The bot has four user roles with different permissions:

| Role | Description | Permissions |
|------|-------------|-------------|
| **Owner** | Bot owner (set via `OWNER_TELEGRAM_ID`) | Full access, cannot be modified or removed |
| **Admin** | Administrator added by owner | Can manage users (add/remove/change role), but not other admins |
| **User** | Regular authorized user | Access to bot commands based on mode |
| **Guest** | Unauthorized user | Can only use `/start` (to activate invite link) |

Role hierarchy: `owner` > `admin` > `user` > `guest`

- Owner can manage admins and users
- Admin can only manage users
- Users and guests cannot manage anyone
- New users need an invite link to access the bot

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

### Transport Modes

The bot supports two transport modes for receiving Telegram updates:

| Mode | Use Case | Behavior |
|------|----------|----------|
| `polling` | Local development | Long polling, may cause 409 conflicts on redeploy |
| `webhook` | Production (Koyeb, etc.) | HTTP webhook, seamless redeploys |

#### Polling (default)

Uses long polling to receive updates. Simple setup, works locally without public URL.

```env
BOT_TRANSPORT=polling
```

#### Webhook

Receives updates via HTTP endpoint. Recommended for production deployments.

```env
BOT_TRANSPORT=webhook
WEBHOOK_URL=https://your-app.koyeb.app/webhook
WEBHOOK_SECRET=your-secret-here
HTTP_HOST=0.0.0.0
```

Generate webhook secret:
```bash
openssl rand -hex 32
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

### Production mode

| Command | Role | Description |
|---------|------|-------------|
| `/start` | guest | Start the bot / show welcome message |
| `/start inv_<token>` | guest | Activate invite link |
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
| `/admin invite [role]` | admin | Create invite link (default role: user) |

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
- **@solana/kit** v5 — Solana SDK
- **better-sqlite3** + **Kysely** — Local database with type-safe query builder
- **tsx** — Run TypeScript without compilation

## License

MIT
