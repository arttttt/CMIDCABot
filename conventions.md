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

### Naming

| Type | Pattern | Example |
|------|---------|---------|
| API client | `*Client` | `JupiterPriceClient` |
| In-memory storage | `*Cache` | `SecretCache` |
| Database adapter | `*DataSource` | `AuthDataSource` |
| Repository interface | `*Repository` | `UserRepository` |
| Use Case | `*UseCase` | `ExecutePurchaseUseCase` |

### Branded Types

Primitives (`number`, `string`) are forbidden for ID-like fields. Use class-based branded types instead.

**Rules:**
- All ID-like fields must use branded types (classes with `readonly value`)
- Use `new Type(value)` at boundaries (presentation layer, DB read)
- Use `.value` to extract primitive at external API boundaries
- Use `.equals()` method for comparison (not `===`)

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
| `docs/drafts/` | Briefs and task specifications |
| `docs/reviews/` | Code review results |
