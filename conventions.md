# Project Conventions

> Правила и соглашения проекта. Обязательны для всех участников (людей и AI).

## Code Style

### Formatting
- Trailing commas — всегда
- Explicit types — избегать `any`
- async/await — без callback hell
- Comments — на английском

### Structure
- Small modules — single responsibility
- Utility functions — класс со static методами (не top-level exports)

### Naming

| Тип | Паттерн | Пример |
|-----|---------|--------|
| API client | `*Client` | `JupiterPriceClient` |
| In-memory storage | `*Cache` | `SecretCache` |
| Database adapter | `*DataSource` | `AuthDataSource` |
| Repository interface | `*Repository` | `UserRepository` |
| Use Case | `*UseCase` | `ExecutePurchaseUseCase` |

## Architecture

См. `ARCHITECTURE.md` для полного описания слоёв и правил.

**Ключевой принцип:** Clean Architecture — зависимости направлены только внутрь.

```
presentation → domain ← data
                 ↑
           infrastructure
```

## Security

- **Secrets** — никогда в коде, только через environment variables
- **Private keys** — только зашифрованные (AES-256-GCM)
- **Logging** — никаких sensitive data в логах
- **Input validation** — на границе presentation layer

## Environment

- Держать `.env.example` актуальным при добавлении переменных
- Solana: только devnet (mainnet запрещён)

## Git Conventions

- Commits — осмысленные сообщения на английском
- Branches — feature/, fix/, refactor/ префиксы
- PR — обязательный review перед merge

## Documentation

| Документ | Назначение |
|----------|------------|
| `ARCHITECTURE.md` | Структура слоёв, правила зависимостей |
| `conventions.md` | Код стайл, правила проекта |
| `CLAUDE.md` | Инструкции для AI-ассистента |
| `docs/briefs/` | Technical briefs от Analyst |
| `docs/tasks/` | Спецификации задач от PM |
| `docs/reviews/` | Результаты code review |
