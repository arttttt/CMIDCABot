---
name: implement
description: "Implement task from issue specification. Use when the user invokes /implement or asks to execute a tracked issue."
---

# Implement Command

Follow `CLAUDE.md`, `conventions.md`, and `ARCHITECTURE.md`.

## Task

Implement functionality from issue specification.

## Interaction Contract

1. Read issue details and blockers.
2. Produce an implementation plan.
3. Wait for explicit approval.
4. Only then create branch, implement, commit, and push.

## Algorithm

### Step 1: Get issue

- If ID missing → ask "Which issue to implement?"
- Normalize ID: add `DCATgBot-` prefix if missing
- Use `beads` to get issue details
- If blocked: report blocker and stop
- Notify: "Found issue: `<id>` - <title>"

### Step 2: Create plan

Create and show plan only; do not implement yet.

```
## Implementation Plan
<plan>
---
Confirm? (ok / changes)
```

### Step 3: On approval

- Claim issue via `beads` (set `in_progress`)
- Create branch via `git` skill
- Implement in small steps
- Commit with conventional messages
- Push to remote

### Step 4: Report

```
Implementation complete
Branch: <branch>
Commits: <list>
Next: /review <id>
```

## Plan Format

```markdown
## Implementation Plan

**Branch:** `feature/<id>-short-description`
**Issue:** <id> - <title>

**Affected layers:**
- [layer]: [changes]

**Files to create/modify:**
- `path/to/file.ts` - [purpose]

**Approach:**
1. [Step 1]
2. [Step 2]
```

## Branch Naming

- `feature/<id>-<short>` for feature, task, epic, chore
- `fix/<id>-<short>` for bug

## Important

- Never implement without approval
- No unrelated changes
- No placeholders
