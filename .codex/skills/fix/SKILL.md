---
name: fix
description: "Fix issues from code review. Use when the user invokes /fix or asks to address review findings for an issue."
---

# Fix Command

Follow `CLAUDE.md`, `conventions.md`, and `ARCHITECTURE.md`.

## Task

Fix issues identified in code review.

## Interaction Contract

1. Fetch review findings.
2. Produce a fix plan.
3. Wait for explicit approval.
4. Implement fixes, commit, push.

## Algorithm

### Step 1: Get findings

- If ID missing → ask "Which issue to fix?"
- Normalize ID: add `DCATgBot-` prefix if missing
- Use `beads` to get issue details + comments
- If no review comments: report "No review findings. Run /review first."
- Parse findings (Critical, Should Fix, Consider)

### Step 2: Create fix plan

Show plan only; do not implement yet.

```
## Fix Plan
<plan>
---
Confirm? (ok / changes)
```

### Step 3: On approval

- Implement fixes per plan
- Commit: `fix(<scope>): address review findings`
- Push to remote

### Step 4: Report

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

- Never fix without plan approval
- Fix documented issues only
- Re-review required
