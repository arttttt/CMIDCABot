---
description: Create or enrich issue specification
argument-hint: "[id|description]"
allowed-tools: Read, Glob, Grep, Bash
---

Use subagent `planner`.

## Task

Create new issue or enrich existing one with full specification.

## Resume Pattern

1. **Main context:** parse argument → determine mode (create/enrich)
2. **Task(planner):** research + draft spec → return `{ draft_spec, questions? }`
3. **Main context:** show draft → wait for "ok"
4. **Task(planner, resume):** create/update issue via skill `beads`

## Algorithm

### Step 1: Parse argument (main context)

- Empty → ask "Describe the task:", wait for response
- ID-like (2-4 chars or `DCATgBot-` prefix) → enrich mode
- Otherwise → create mode, use as description

### Step 2: Subagent — research and draft

Prompt:
```
Mode: <create|enrich>
Argument: <id or description>

Research context, prepare specification draft.
Return: { status: "needs_confirmation", draft_spec, title?, questions? }
DO NOT create/update issue yet.
```

### Step 3: Show to user (main context)

```
## Specification Draft
<draft_spec>
---
Confirm? (ok / corrections)
```

### Step 4: Resume subagent

- If "ok": `resume` → create/update issue
- If corrections: `resume` with corrections → update draft, create/update issue

### Step 5: Report

- Create: "Created: `<id>` — <title>"
- Enrich: "Updated: `<id>` — <title>"

## Issue Description Format

```markdown
## Context
[Why this matters — 2-3 sentences]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Scope
[What IS included]

## Out of Scope
[What is NOT included]

## Technical Notes
[Optional — implementation hints]
```

## Important

- **Never skip confirmation** — always show draft first
- **Resume preserves context** — no need to re-research
