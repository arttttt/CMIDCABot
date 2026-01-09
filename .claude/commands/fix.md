---
description: Fix issues from code review
argument-hint: "<review_name> | <task_id>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Use subagent `developer`.

## Task

Fix issues identified in code review.

## Interaction Contract (MUST follow)

| Phase | Who | Action | STOP until |
|-------|-----|--------|------------|
| 1. Plan | Subagent | Create and show fix plan | User says "da" / "ok" / "yes" |
| 2. Implement | Subagent | Fix issues, commit, push | — |

**Fixing code without phase 1 approval is a critical violation.**
**Main context does NOT create plans — delegate to subagent.**

User may adjust scope during phase 1 (subagent handles iterations).

### Plan Format

```markdown
## Fix Plan

**Branch:** current branch
**Review:** `docs/reviews/REVIEW_xxx.md`

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
   - If `$ARGUMENTS` is empty or whitespace only:
     - Ask: "Which review to fix? Provide review name or task ID."
     - Wait for response
   - Otherwise: use as search term

2. **Find REVIEW file:**
   - Try: `docs/reviews/REVIEW_*<name>*.md`
   - If not found: error "Review not found. Run /review first."

3. **Parse REVIEW file:**
   - Extract `**Task:** <task_id>` from header
   - Extract findings by severity (Critical, Should Fix, Consider)
   - Extract finding codes ([C1], [S1], [N1])
   - Note file locations from findings

4. **Delegate to subagent `developer` (plan phase):**
   - Subagent creates plan per format above
   - Default: fix all Critical and Should Fix, suggest deferring Consider
   - Subagent shows plan to user, waits for approval
   - User may adjust scope (subagent handles iterations)
   - Subagent returns confirmed plan
   - **Main context does NOT create plans itself**

5. **Delegate to subagent `developer` (implementation phase):**
   - Implement fixes per confirmed plan
   - Commit with format:
     ```
     fix(<scope>): address review findings

     Fixes:
     - [C1] <description>
     - [S1] <description>

     [Task: <id>]
     ```
   - Push to remote

6. **Report completion:**
   ```
   Fixes complete for <task-id>.

   Fixed:
   - [C1] Description
   - [S1] Description

   Run /review <task-id> to verify fixes.
   ```

## Output

Code changes only. Does not modify REVIEW file.
New review (v2) created by subsequent `/review` if needed.

## Severity Handling

| Severity | Default Action |
|----------|----------------|
| Critical | Always fix |
| Should Fix | Fix by default |
| Consider | Suggest defer, user decides |

## Skills Integration

Fixes are implemented via the developer subagent, which uses skill `git` for version control operations:
- Making commits
- Pushing to remote

See skill references for conventions and detailed instructions.

## Review Versioning

After `/fix`, user runs `/review` again -> creates `REVIEW_<name>_v2.md`
Naming: `_v2`, `_v3`, etc.

## Important Rules

- **Fix documented issues only** — no scope creep
- **Plan before fixing** — get user approval
- **Re-review required** — always run /review after /fix
- **No new features** — fix mode only
