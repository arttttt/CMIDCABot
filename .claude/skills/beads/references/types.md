# Issue Types & Priorities

## Issue Types

| Type | When to use |
|------|-------------|
| `bug` | Something broken that worked before |
| `feature` | New functionality for users |
| `task` | Work item: tests, docs, refactoring |
| `epic` | Large feature with subtasks |
| `chore` | Maintenance: dependencies, tooling |

## Priorities

| Priority | Meaning | Examples |
|----------|---------|----------|
| `0` (P0) | Critical | Security, data loss, broken builds |
| `1` (P1) | High | Major features, important bugs |
| `2` (P2) | Medium | Default, nice-to-have (default) |
| `3` (P3) | Low | Polish, optimization |
| `4` (P4) | Backlog | Future ideas |

## Usage

```bash
bd create "Title" -t feature -p 1 --json
bd create "Fix login" -t bug -p 0 --json
```
