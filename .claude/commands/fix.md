---
description: Fix issues from code review
argument-hint: "<issue_id>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Use subagent `developer`.

## Task

Fix issues identified in code review.

## Interaction Contract (MUST follow)

| Phase | Who | Action | STOP until |
|-------|-----|--------|------------|
| 1. Plan | Subagent | Create and show fix plan | User says "ok" |
| 2. Implement | Subagent | Fix issues, commit, push | — |

**Fixing code without phase 1 approval is a critical violation.**
**Main context does NOT create plans — delegate to subagent.**

### Plan Format

```markdown
## Fix Plan

**Issue:** <id> - <title>
**Branch:** <current branch>

**Findings to fix:**
- [C1] Title - approach
- [S1] Title - approach

**Deferred (with reason):**
- [N1] Title - why deferred

**Files to modify:**
- `path/to/file.ts` - [changes]

Confirm?
```

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty → ask "Which issue to fix?"
   - Otherwise: use as issue ID

2. **Get issue and review findings (main context):**
   - Normalize ID: if no `DCATgBot-` prefix, add it
   - Use skill `beads` to get issue details
   - Use skill `beads` to get issue comments (review findings)
   - If no review comments found: error "No review findings. Run /review first."
   - Notify user: "Found issue: `<id>` - <title>"
   - Parse findings from latest review comment (Critical, Should Fix, Consider)

3. **Delegate to subagent `developer` (plan phase):**
   - Subagent creates plan per format above
   - Default: fix all Critical and Should Fix, suggest deferring Consider
   - Subagent shows plan to user, waits for approval
   - User may adjust scope (subagent handles iterations)

4. **Delegate to subagent `developer` (implementation phase):**
   - Implement fixes per confirmed plan
   - Commit with format:
     ```
     fix(<scope>): address review findings

     Fixes:
     - [C1] <description>
     - [S1] <description>
     ```
   - Push to remote

5. **Report completion:**
   ```
   Fixes complete for <id>.

   Fixed:
   - [C1] Description
   - [S1] Description

   Run /review <id> to verify fixes.
   ```

## Severity Handling

| Severity | Default Action |
|----------|----------------|
| Critical | Always fix |
| Should Fix | Fix by default |
| Consider | Suggest defer, user decides |

## Skills Integration

Use skill `beads` for:
- Getting issue details
- Getting review comments (findings)

Use skill `git` for:
- Making commits
- Pushing to remote

## Important Rules

- **Fix documented issues only** — no scope creep
- **Plan before fixing** — get user approval
- **Re-review required** — always run /review after /fix
- **No new features** — fix mode only
