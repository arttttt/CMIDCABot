# Dependencies

## Types

| Type | Effect | When to use |
|------|--------|-------------|
| `blocks` | Affects `bd ready` | Task B cannot start until A is done |
| `discovered-from` | Informational | Found during work on parent task |
| `related` | Informational | Loosely connected, no execution order |

## blocks

Most important — determines what's ready to work on.

```bash
# A blocks B (B depends on A)
bd dep add <B-id> <A-id> --type blocks
```

B won't appear in `bd ready` until A is closed.

## discovered-from

Track where new issues came from.

```bash
# Found bug while working on feature
bd create "Found bug" -t bug -p 1 --json
bd dep add <new-id> <parent-id> --type discovered-from
```

## related

Loose connection, no effect on execution.

```bash
bd dep add <id1> <id2> --type related
```

## Viewing Dependencies

```bash
bd show <id>           # Shows depends on / blocks
bd dep tree <id>       # Full dependency tree
bd blocked             # All blocked issues
```
