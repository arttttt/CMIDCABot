# Branch Naming Conventions

## Branch Types

| Type | Purpose | Example |
|------|---------|---------|
| `feature/` | New functionality | `feature/portfolio-rebalance` |
| `fix/` | Bug fixes, review findings | `fix/swap-timeout` |
| `refactor/` | Code restructuring | `refactor/wallet-encryption` |

## Naming Rules

- Use kebab-case: `feature/my-feature-name`
- Keep names short but descriptive
- Include ticket reference if applicable: `feature/123-user-auth`

## Examples

```bash
# New feature from TASK/BRIEF
git checkout -b feature/dca-scheduling

# Bug fix
git checkout -b fix/transaction-timeout

# Refactoring
git checkout -b refactor/extract-swap-logic
```

## Workflow

1. Always create branch from up-to-date `main`
2. One branch per task/issue
3. Delete branch after PR is merged
