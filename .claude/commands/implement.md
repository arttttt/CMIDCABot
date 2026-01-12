---
description: Implement task from issue
argument-hint: "<issue_id>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Use subagent `developer`.

## Task

Implement functionality from issue specification.

## Resume Pattern

1. **Main context:** get issue via `beads`, verify not blocked
2. **Task(developer):** research + create plan → return `{ plan }` + `agent_id`
3. **Main context:** save `agent_id`, show plan → wait for "ok" → claim issue (set in_progress)
4. **Task(developer, resume=agent_id):** implement, commit, push

## Algorithm

### Step 1: Get issue (main context)

- If `$ARGUMENTS` empty → ask "Which issue to implement?"
- Normalize ID: add `DCATgBot-` prefix if missing
- Use skill `beads` to get issue details
- If blocked: report blocker and exit
- Notify: "Found issue: `<id>` - <title>"

### Step 2: Subagent — create plan

Call `Task(developer)` and **save returned `agent_id`**.

Prompt:
```
Issue: <id> - <title>
Description: <description>
Acceptance criteria: <criteria>

Create implementation plan.
Return: { status: "needs_approval", plan }
DO NOT implement yet.
```

### Step 3: Show plan (main context)

```
## Implementation Plan
<plan>
---
Confirm? (ok / changes)
```

After "ok": claim issue via `beads` (set in_progress)

### Step 4: Resume subagent

Call `Task(developer, resume=agent_id)`:

```
User approved. Implement:
1. Create branch via skill `git`
2. Implement with granular commits
3. Push to remote
```

### Step 5: Report

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

- **Never implement without plan approval**
- **Resume preserves context** — subagent remembers research
- **Code must be complete** — no placeholders
- **Do NOT close issue** — wait for review
