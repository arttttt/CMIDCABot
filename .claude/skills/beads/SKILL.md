---
name: beads
description: "Issue tracking with Beads (bd CLI). Use when commands need to create, query, or update issues."
allowed-tools: Bash
---

# Beads Issue Tracker

## When to Use

- Creating or updating issues
- Querying ready/blocked tasks
- Managing dependencies
- Closing completed work

## Core Concepts

- **bd ready** — tasks with no blockers
- **Status**: open → in_progress → closed
- **Types**: task, bug, feature, epic, chore
- **Priority**: 0 (critical) → 4 (low), default 2
- **Dependencies**: only `blocks` affects ready

## Commands Reference

### Create
bd create "Title" -d "Description" -t task -p 2 --json
bd create "Feature X" -t epic -p 1 -d "Context" --json
bd create "Subtask" -t task -p 2 --parent <epic-id> --json

### Dependencies
bd dep add <B-id> <A-id> --type blocks        # A blocks B
bd dep add <new-id> <parent-id> --type discovered-from
bd dep add <id1> <id2> --type related

### Query
bd ready --json
bd show <id> --json
bd list --status open --json
bd blocked --json
bd dep tree <id>

### Update
bd update <id> --status in_progress --json
bd update <id> -d "New description" --json
bd update <id> --notes "Progress update" --json

### Close
bd close <id> --reason "Done: summary" --json

### Sync
bd sync

## References

- `references/types.md` — Issue types and priorities
- `references/dependencies.md` — Dependency types and usage
