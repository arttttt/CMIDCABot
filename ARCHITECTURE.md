# Architecture

> Single source of truth for project architecture. All other docs reference this file.

## Target Directory Structure

```
src/
├── domain/
│   ├── models/              # entities
│   ├── policies/            # pure domain rules (no I/O)
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
domain          → infrastructure/shared (logging, math, config)
                → domain/policies
data            → domain/repositories (interfaces)
                → domain/models
                → domain/policies
                → infrastructure/internal
                → infrastructure/shared
presentation    → domain/usecases
                → domain/models
                → domain/policies
                → infrastructure/shared
infrastructure  → (nothing, except shared between own modules)
```

> **Note:** Domain may use `infrastructure/shared` for pure utilities (logging, math).
> Domain must NOT use `infrastructure/internal` — those are for data layer only.

**Key rule:** Dependencies point inward only.

## Domain Models & Policies

- **Domain models** — only data and types. No validation, no calculations, no business rules.
- **Domain policies** — pure business rules and calculations. No I/O, no repository calls.
- **Use cases** — scenarios. They call repositories and policies to complete a flow.

## Key Principles

| Principle | Description |
|-----------|-------------|
| Service = API client only | HTTP/RPC clients to external systems |
| Services behind repositories | Domain works only with interfaces |
| Data sources by type | Separation: database / memory / api |
| Infrastructure: internal/shared | internal — data only, shared — all layers |
| Use cases return domain objects | Not UI structures — formatters handle transformation |
| Formatters: domain → UI | Separation of concerns between layers |
| Thin adapters | Map external input/output to internal protocol only |
| Explicit dependencies | Constructor injection, no global state |
| Single documentation | `ARCHITECTURE.md` |

## Anti-patterns (Prohibited)

| Prohibition | Reason |
|-------------|--------|
| **Utils/helpers/common** | Become dumps. Each component must have a specific place |
| **Domain Services** | Not used. All business logic in Use Cases |
| **Direct service access from domain** | Domain works only with repository interfaces |
| **Business logic in data layer** | Data only stores/retrieves data, makes no decisions |
| **Event bus / implicit coupling** | Makes dependencies hidden and hard to trace |
| **Business logic in adapters/formatters** | Adapters are thin, logic belongs in use cases |
| **Direct DB access from presentation** | Violates layer separation, use repositories |
| **Framework deps in domain** | Domain must be pure, no external framework imports |

## Naming Conventions

| Component Type | Suffix/Pattern | Example |
|----------------|----------------|---------|
| API client | `*Client` | `SolanaRpcClient`, `JupiterPriceClient` |
| In-memory storage | `*Cache` | `SecretCache`, `ImportSessionCache` |
| Database adapter | `*DataSource` | `AuthDataSource` |
| Repository interface | `*Repository` | `UserRepository` |
| Repository implementation | (no suffix, in data/repositories/) | `UserRepositoryImpl` or just in file |
| Use Case | `*UseCase` | `ExecutePurchaseUseCase` |
