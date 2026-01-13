# Commit Message Format

## Conventional Commits

Format:
```
<type>(<scope>): <description>
```

## Types

| Type | When to Use |
|------|-------------|
| `feat` | New functionality |
| `fix` | Bug fix or review finding |
| `refactor` | Code change without new behavior |
| `chore` | Configs, dependencies, tooling |
| `docs` | Documentation only |
| `test` | Adding or fixing tests |

## Rules

1. **Granular commits** — one logical change per commit
2. **Atomic** — each commit leaves code in working state
3. **Present tense** — "add" not "added"
4. **No period** at the end
5. **Under 50 chars** for summary line

## Examples

```bash
# Feature
git commit -m "feat(portfolio): add rebalance calculation"

# Fix
git commit -m "fix(swap): handle timeout errors"

# Refactor
git commit -m "refactor(wallet): extract encryption logic"

# Chore
git commit -m "chore(config): add new env variable"
```
