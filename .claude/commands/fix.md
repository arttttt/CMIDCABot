---
description: Fix issues from code review
argument-hint: "<issue_id>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Use subagent `developer`.

## Task

Fix issues identified in code review.

## Resume Pattern

1. **Main context:** get issue + review findings via `beads`
2. **Task(developer):** analyze findings → return `{ fix_plan }` + `agent_id`
3. **Main context:** save `agent_id`, show plan → wait for "ok"
4. **Task(developer, resume=agent_id):** implement fixes, commit, push

## Algorithm

### Step 1: Get findings (main context)

- If `$ARGUMENTS` empty → ask "Which issue to fix?"
- Normalize ID: add `DCATgBot-` prefix if missing
- Use skill `beads` to get issue details + comments
- If no review comments: error "No review findings. Run /review first."
- Parse findings (Critical, Should Fix, Consider)

### Step 2: Subagent — create fix plan

Call `Task(developer)` and **save returned `agent_id`**.

Prompt:
```
Issue: <id> - <title>
Review findings: <findings>

Create fix plan.
Default: fix Critical + Should Fix, suggest defer Consider.
Return: { status: "needs_approval", fix_plan }
DO NOT implement yet.
```

### Step 3: Show plan (main context)

```
## Fix Plan
<plan>
---
Confirm? (ok / changes)
```

### Step 4: Resume subagent

Call `Task(developer, resume=agent_id)`:

```
User approved. Implement fixes:
1. Apply fixes per plan
2. Commit: fix(<scope>): address review findings
3. Push to remote
```

### Step 5: Report

```
Fixes complete for <id>.
Fixed: [C1], [S1]...
Next: /review <id>
```

## Plan Format

```markdown
## Fix Plan

**Issue:** <id> - <title>
**Branch:** <current>

**Findings to fix:**
- [C1] Title - approach
- [S1] Title - approach

**Deferred:**
- [N1] Title - reason
```

## Severity Handling

| Severity | Default |
|----------|---------|
| Critical | Always fix |
| Should Fix | Fix by default |
| Consider | Suggest defer |

## Important

- **Never fix without plan approval**
- **Resume preserves context**
- **Fix documented issues only** — no scope creep
- **Re-review required** — always run /review after
