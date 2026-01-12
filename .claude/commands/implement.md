---
description: Implement task from issue
argument-hint: "<issue_id>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Use subagent `developer`.

## Task

Implement functionality from issue specification.

## Interaction Contract (MUST follow)

| Phase | Who | Action | STOP until |
|-------|-----|--------|------------|
| 1. Plan | Subagent | Create and show plan | User says "ok" |
| 2. Claim | Main context | Update status to "in_progress" | — |
| 3. Implement | Subagent | Code, commit, push per plan | — |

**Writing code without phase 1 approval is a critical violation.**
**Main context does NOT create plans — delegate to subagent.**

### Plan Format

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

Confirm?
```

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty → ask "Which issue to implement?"
   - Otherwise: use as issue ID

2. **Get issue details (main context, before subagent):**
   - Normalize ID: if no `DCATgBot-` prefix, add it
   - Use skill `beads` to get issue details
   - Verify issue exists and is not blocked
   - If blocked: report blocker and exit
   - If found: notify user "Found issue: `<id>` - <title>"
   - Pass issue context (title, description, acceptance criteria) to subagent

3. **Delegate to subagent `developer` (plan phase):**
   - Subagent reads issue requirements
   - Subagent creates plan per format above
   - Subagent shows plan to user, waits for approval
   - User may request changes (subagent handles iterations)
   - Subagent returns confirmed plan

4. **Claim issue (main context):**
   - Use skill `beads` to set status to "in_progress"

5. **Delegate to subagent `developer` (implementation phase):**
   - Create branch using skill `git`:
     - `feature/<id>-<short>` for feature, task, epic, chore
     - `fix/<id>-<short>` for bug
   - Implement with granular commits:
     - Write code for one logical change
     - Commit with conventional message: `<type>(<scope>): <description>`
     - Repeat until done
   - Push branch to remote

6. **Report completion:**
   ```
   Implementation complete

   **Branch:** `<branch-name>`
   **Commits:**
   - `<hash>` <message>

   **Pushed to remote.**

   Next: run /review <id> to check implementation.
   ```

## Skills Integration

Use skill `git` for all git operations:
- Creating branches
- Making commits
- Pushing to remote

Use skill `beads` for tracker operations:
- Getting issue details
- Claiming issue (set in_progress)

**Note:** Tracker operations are performed by main context before/after delegating to subagent.

## Important

- Code must be complete, no placeholders
- Do NOT close issue — wait for review
- Do NOT merge — PR review required
- Ask if unclear — better to clarify than assume
- Use `conventions.md` and `ARCHITECTURE.md` for code style
