# Project Conventions

> Project rules and conventions. Mandatory for all participants (humans and AI).

## Code Style

### Formatting
- Trailing commas — always
- Explicit types — avoid `any`
- async/await — no callback hell
- Comments — in English

### Structure
- Small modules — single responsibility
- Utility functions — class with static methods (not top-level exports)
  - **Exception:** branded type constructors (e.g., `telegramId()`) — top-level functions allowed

### Naming

| Type | Pattern | Example |
|------|---------|---------|
| API client | `*Client` | `JupiterPriceClient` |
| In-memory storage | `*Cache` | `SecretCache` |
| Database adapter | `*DataSource` | `AuthDataSource` |
| Repository interface | `*Repository` | `UserRepository` |
| Use Case | `*UseCase` | `ExecutePurchaseUseCase` |

### Branded Types

**Primitives (`number`, `string`) are forbidden for ID-like fields.** Use branded types from `src/domain/models/id/`:

| Type | Purpose | Example |
|------|---------|---------|
| `TelegramId` | Telegram user ID | `telegramId(123456789)` |
| `WalletAddress` | Solana wallet address | `walletAddress("ABC...")` |
| `TxSignature` | Transaction signature | `txSignature("xyz...")` |
| `TokenMint` | SPL token mint address | `tokenMint("EPjFW...")` |
| `RequestId` | Request tracing UUID | `requestId("uuid...")` |
| `SessionId` | HTTP session ID | `sessionId("sess...")` |

**Rules:**
- All new ID-like fields must use branded types
- Import from `domain/models/id/` (or `domain/models/` which re-exports them)
- Use constructors at boundaries (presentation layer, DB read)
- Cast with `as number/string` only at external API boundaries (grammY, Kysely)

## Architecture

See `ARCHITECTURE.md` for full description of layers and rules.

**Key principle:** Clean Architecture — dependencies point inward only.

```
presentation → domain ← data
                 ↑
           infrastructure
```

## Security

- **Secrets** — never in code, only via environment variables
- **Private keys** — encrypted only (AES-256-GCM)
- **Logging** — no sensitive data in logs
- **Input validation** — at presentation layer boundary

## Environment

- Keep `.env.example` up-to-date when adding variables
- Solana: devnet only (mainnet prohibited)

## Git Conventions

- Commits — meaningful messages in English
- Branches — feature/, fix/, refactor/ prefixes
- PR — mandatory review before merge

## Documentation

| Document | Purpose |
|----------|---------|
| `ARCHITECTURE.md` | Layer structure, dependency rules |
| `conventions.md` | Code style, project rules |
| `CLAUDE.md` | Instructions for AI assistant |
| `docs/briefs/` | Technical briefs from Analyst |
| `docs/tasks/` | Task specifications from PM |
| `docs/reviews/` | Code review results |
