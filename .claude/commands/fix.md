---
description: Fix issues from code review
argument-hint: "<review_name> | <task_name>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Use subagent `developer`.

## Task

Fix issues identified in code review.

## Interaction Contract (MUST follow)

| Phase | Action | STOP until |
|-------|--------|------------|
| 1. Plan | Show fix plan (findings to fix, approach) | User says "да" / "ok" / "yes" |
| 2. Implement | Fix issues, commit, push | — |

🚨 **Fixing code without phase 1 approval is a critical violation.**

User may adjust scope during phase 1 (add/remove findings to fix).

### Plan Format

```markdown
## Fix Plan

**Branch:** `fix/short-description`
**Review:** `docs/reviews/REVIEW_xxx.md`

**Findings to fix:**
- [C1] Title — approach
- [S1] Title — approach

**Deferred (with reason):**
- [N1] Title — why deferred

**Files to modify:**
- `path/to/file.ts` — [changes]

Подтверждаешь?
```

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - List REVIEW files in `docs/reviews/`
     - Ask user which to fix
   - Otherwise: use as search term

2. **Find REVIEW file:**
   - Try: `docs/reviews/REVIEW_*<n>*.md`
   - If not found by review name, try finding by task/brief name
   - If not found: error "Review not found"

3. **Parse REVIEW file:**
   - Extract findings by severity (🔴, 🟡, 🟢)
   - Extract finding codes ([C1], [S1], [N1])
   - Note file locations from findings

4. **Find related source (optional):**
   - Check for tracker item link in REVIEW (see skill `tracker-github` for link format)
   - Try to find related TASK/BRIEF for additional context

5. **Execute Interaction Contract:**
   - Create plan per format above
   - Default: fix all 🔴 and 🟡, suggest deferring 🟢
   - Wait for user approval (user may adjust scope)
   - Do NOT proceed to fixes until approved

6. **After confirmation:** implement fixes

7. **After fixes applied:**
   - Report which findings were fixed
   - Remind: `Для повторной проверки запусти /review <name>`

## Output

Code changes only. Does not modify REVIEW file.
New review (v2) created by subsequent `/review` if needed.

## Severity Handling

| Severity | Default Action |
|----------|----------------|
| 🔴 Critical | Always fix |
| 🟡 Should Fix | Fix by default |
| 🟢 Consider | Suggest defer, user decides |

## Skills Integration

Fixes are implemented via the developer subagent, which uses skill `git` for version control operations:
- Creating branches
- Making commits
- Pushing to remote

See skill references for conventions and detailed instructions.

## Review Versioning

After `/fix`, user runs `/review` again → creates `REVIEW_<name>_v2.md`
Naming: `_v2`, `_v3`, etc.
