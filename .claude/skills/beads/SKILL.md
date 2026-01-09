---
name: beads
description: "Issue tracking with Beads. Commands abstract bd CLI — user never writes bd commands directly."
allowed-tools: Bash
---

# Beads Issue Tracker

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

## Draft Tracking
`docs/drafts/.refs.json` tracks draft-to-issue mapping.

## Session End Protocol
1. bd update <id> --notes "..."
2. bd close <id> --reason "..."
3. bd sync
4. git push

## References

- `references/types.md` — Issue types and priorities
- `references/dependencies.md` — Dependency types and usage
- `references/rules.md` — Do/Don't rules and session protocol
