# /status — Show Project Status

Display issue tracker status and task details.

## Arguments

- `<id>` — Task ID (optional)

## Subagent

None — execute in main context using `beads` skill.

## Workflow

### Mode 1: Specific Task (with `<id>`)

Show detailed task information:

```bash
bd show <id> --json
bd dep tree <id>
```

Output:
```
Task: <id> — <title>
Status: <status>
Type: <type>
Priority: <priority>

Description:
<description>

Dependency Tree:
<tree output>
```

### Mode 2: Project Overview (no `<id>`)

Show overall project status:

```bash
bd list --status open --json
bd ready --json
bd blocked --json
```

Output:
```
Project Status
==============

Stats:
- Open tasks: <count>
- Ready to work: <count>
- Blocked: <count>

Ready Tasks (can start now):
- <id1> — <title> (P<priority>)
- <id2> — <title> (P<priority>)

Blocked Tasks:
- <id3> — <title>
  Blocked by: <blocker-id> (<blocker-status>)
- <id4> — <title>
  Blocked by: <blocker-id> (<blocker-status>)

In Progress:
- <id5> — <title>
```

## Output Sections

### Stats
- Total open issues
- Ready count (from `bd ready`)
- Blocked count (from `bd blocked`)

### Ready Tasks
Tasks with no blockers, sorted by priority (P0 first).
These can be picked up with `/implement`.

### Blocked Tasks
Tasks waiting on dependencies.
Shows what's blocking each task.

### In Progress
Tasks currently being worked on.
Shows assignee if available.

## Example — Project Overview

```
User: /status

Project Status
==============

Stats:
- Open tasks: 12
- Ready to work: 3
- Blocked: 7
- In progress: 2

Ready Tasks:
- DCATgBot-abc — Setup wallet adapter (P1)
- DCATgBot-def — Add config validation (P2)
- DCATgBot-ghi — Update README (P3)

Blocked Tasks:
- DCATgBot-jkl — Implement swap
  Blocked by: DCATgBot-abc (open)
- DCATgBot-mno — Add tests
  Blocked by: DCATgBot-jkl (open)

In Progress:
- DCATgBot-pqr — Database schema
```

## Example — Specific Task

```
User: /status DCATgBot-abc

Task: DCATgBot-abc — Setup wallet adapter
Status: open
Type: task
Priority: 1 (High)

Description:
Implement Solana wallet adapter for connecting user wallets.

Acceptance Criteria:
- [ ] WalletAdapter interface defined
- [ ] Phantom wallet support
- [ ] Connection state management

Dependency Tree:
DCATgBot-abc (open)
├── blocks: DCATgBot-jkl (open)
│   └── blocks: DCATgBot-mno (open)
└── parent: DCATgBot-xyz (epic, open)
```

## Notes

- Use `bd ready` output to suggest next task for `/implement`
- Blocked tasks show their immediate blocker and its status
- Priority displayed as P0-P4 for quick scanning
