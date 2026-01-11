---
description: Implement task from specification
argument-hint: "<task_id>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Use subagent `developer`.

## Task

Implement functionality from task specification.

## Interaction Contract (MUST follow)

| Phase | Who | Action | STOP until | Steps |
|-------|-----|--------|------------|-------|
| 1. Plan | Subagent | Create and show plan | User says "da" / "ok" / "yes" | 1-3 |
| 2. Claim | Main context | Update status to "in_progress" | — | 4 |
| 3. Implement | Subagent | Code, commit, push per plan | — | 5-6 |

**Writing code without phase 1 approval is a critical violation.**
**Main context does NOT create plans — delegate to subagent.**

### Plan Format

```markdown
## Implementation Plan

**Branch:** `feature/<id>-short-description`
**Task:** <id> - <title>

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
   - If `$ARGUMENTS` is empty or whitespace only:
     - Ask: "Which task to implement? Provide task ID."
     - Wait for response
   - Otherwise: use `$ARGUMENTS` as task ID

2. **Get task details (main context, before subagent):**
   - Determine if argument looks like an issue ID:
     - 2-4 characters without spaces (e.g., "9en", "abc")
     - OR contains "DCATgBot-" prefix (e.g., "DCATgBot-9en")
   - Normalize ID: if no prefix, add "DCATgBot-" prefix
   - **Use skill `beads` to get issue details**
   - Verify task exists and is not blocked
   - If blocked: report blocker and exit
   - If found: notify user "Found issue: `<id>` - <title>"
   - Pass issue context (title, description, status) inline to subagent

3. **Delegate to subagent `developer` (plan phase):**
   - Subagent reads task requirements
   - Subagent creates plan per format above
   - Subagent shows plan to user, waits for approval
   - User may request changes (subagent handles iterations)
   - Subagent returns confirmed plan
   - **Main context does NOT create plans itself**

4. **Claim task** (main context):
   - Use `beads` skill to set status to "in_progress"

5. **Delegate to subagent `developer` (implementation phase):**
   - Create branch using `git` skill:
     - `feature/<id>-<short>` for feature, task, epic, chore
     - `fix/<id>-<short>` for bug
   - **Save branch to refs.json:**
     - Read `docs/drafts/.refs.json`
     - Find entry where `issue_id` matches task_id (iterate entries)
     - Add `"branch": "<branch_name>"` to that entry
     - Write updated refs.json
   - Implement with granular commits:
     - Write code for one logical change
     - Commit with conventional message: `<type>(<scope>): <description>`
     - Include `[Task: <id>]` in commit body
     - Repeat until done
   - Push branch to remote

6. **Report completion:**
   ```
   Implementation complete

   **Branch:** `<branch-name>`
   **Commits:**
   - `<hash>` <message>
   - `<hash>` <message>

   **Pushed to remote.**

   Next: run /review to check implementation.
   ```

## Skills Integration

Use skill `git` for all git operations:
- Creating branches
- Making commits
- Pushing to remote

Use skill `beads` for tracker operations:
- Getting task details
- Claiming task (set in_progress)

See skill references for detailed instructions.

**Note:** Tracker operations are performed by main context before/after delegating to subagent.

## Important

- Code must be complete, no placeholders
- Do NOT close task — wait for review
- Do NOT merge — PR review required
- Ask if unclear — better to clarify than assume
- Use `conventions.md` and `ARCHITECTURE.md` for code style
