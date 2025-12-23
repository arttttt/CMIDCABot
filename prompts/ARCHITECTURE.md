# Architecture

> Single source of truth for project architecture. All other docs reference this file.

## Target Directory Structure

```
src/
├── domain/
│   ├── models/              # entities
│   ├── usecases/            # business logic
│   └── repositories/        # interfaces (ports)
│
├── data/
│   ├── repositories/        # implementations (use sources)
│   ├── sources/
│   │   ├── database/        # SQLite adapters
│   │   ├── memory/          # in-memory caches
│   │   └── api/             # external API clients
│   └── factories/
│
├── infrastructure/
│   ├── internal/            # only for data layer
│   │   └── crypto/          # KeyEncryption
│   └── shared/              # accessible by all layers
│       ├── logging/         # Logger, LogSanitizer
│       └── config/          # AppConfig
│
├── presentation/
│   ├── telegram/
│   ├── web/
│   ├── commands/
│   ├── formatters/
│   └── protocol/
│
└── _wip/
    └── dca-scheduling/      # DcaScheduler (deferred)
```

## Layer Access Rules

```
domain          → (nothing, only own interfaces)
data            → domain/repositories (interfaces)
                → infrastructure/internal
                → infrastructure/shared
presentation    → domain/usecases
                → infrastructure/shared
infrastructure  → (nothing, except shared between own modules)
```

**Key rule:** Dependencies point inward only.

## Key Principles

| Principle | Description |
|-----------|-------------|
| Service = API client only | HTTP/RPC clients to external systems |
| Services behind repositories | Domain works only with interfaces |
| Data sources by type | Separation: database / memory / api |
| Infrastructure: internal/shared | internal — data only, shared — all layers |
| Single documentation | `prompts/ARCHITECTURE.md` |

## Anti-patterns (Prohibited)

| Prohibition | Reason |
|-------------|--------|
| **Utils/helpers/common** | Become dumps. Each component must have a specific place |
| **Domain Services** | Not used. All business logic in Use Cases |
| **Direct service access from domain** | Domain works only with repository interfaces |
| **Business logic in data layer** | Data only stores/retrieves data, makes no decisions |

## Naming Conventions

| Component Type | Suffix/Pattern | Example |
|----------------|----------------|---------|
| API client | `*Client` | `SolanaRpcClient`, `JupiterPriceClient` |
| In-memory storage | `*Cache` | `SecretCache`, `ImportSessionCache` |
| Database adapter | `*DataSource` | `AuthDataSource` |
| Repository interface | `*Repository` | `UserRepository` |
| Repository implementation | (no suffix, in data/repositories/) | `UserRepositoryImpl` or just in file |
| Use Case | `*UseCase` | `ExecutePurchaseUseCase` |
