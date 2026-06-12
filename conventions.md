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
- Use cases expose a single public method: `execute`
- Domain-level constants belong in `src/domain/constants/`

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

Additional rules:
- Domain models are data-only (no validation, no rules, no calculations).
- Domain policies are pure rules/calculations without I/O.
- Use cases orchestrate repositories and policies.

## Security

- **Secrets** — never in code, only via environment variables
- **Private keys** — encrypted only (AES-256-GCM)
- **Logging** — no sensitive data in logs
- **Input validation** — at presentation layer boundary

## Concurrency

- **Balance-changing operations** — must be guarded by a per-user lock at the use case level to prevent parallel execution.

## Environment

- Keep `.env.example` up-to-date when adding variables
- Solana: mainnet (real funds — double-check wallet/swap changes)

## Git Conventions

- Commits — meaningful messages in English
- Branches — feature/, fix/, refactor/ prefixes
- PR — mandatory review before merge

## Documentation

| Document | Purpose |
|----------|---------|
| `ARCHITECTURE.md` | Layer structure, dependency rules |
| `conventions.md` | Code style, project rules |
| `CLAUDE.md` | Instructions for AI assistants |
