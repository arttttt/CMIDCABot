---
description: Implement task from specification
argument-hint: "<task_name> | <file_path>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Use subagent `developer`.

## Task

Implement functionality from specification or brief.

## Interaction Contract (MUST follow)

| Phase | Who | Action | STOP until |
|-------|-----|--------|------------|
| 1. Plan | Subagent | Create and show plan | User says "да" / "ok" / "yes" |
| 2. Tracker | Main context | Update status to "implementation" | — |
| 3. Implement | Subagent | Code, commit, push per plan | — |

🚨 **Writing code without phase 1 approval is a critical violation.**
🚨 **Main context does NOT create plans — delegate to subagent.**

### Plan Format

```markdown
## Implementation Plan

**Branch:** `feature/short-description`
**Source:** `docs/tasks/TASK_xxx.md` (Tracker #123)

**Affected layers:**
- [layer]: [changes]

**Files to create/modify:**
- `path/to/file.ts` — [purpose]

**Approach:**
1. [Step 1]
2. [Step 2]

Подтверждаешь?
```

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - List files in `docs/tasks/` and `docs/briefs/`
     - Ask user which to implement
   - If file path provided: use it
   - If name provided: find source file (see priority below)

2. **Find source file (priority order):**
   - First: `docs/tasks/TASK_<name>.md` — full specification
   - Fallback: `docs/briefs/BRIEF_<name>.md` — implement directly from brief
   - If neither found: ask user to create spec or brief first

3. **Read source file**
   - **Extract tracker item ID** (see skill `tracker-github` for link format)
   - Note source type: TASK or BRIEF

4. **Delegate to subagent `developer` (plan phase):**
   - Subagent creates plan per format above
   - Subagent shows plan to user, waits for approval
   - User may request changes (subagent handles iterations)
   - Subagent returns confirmed plan
   - **Main context does NOT create plans itself**

5. **Update tracker status** (main context):
   - If tracker item found, update status to "implementation" (see skill `tracker-github` for status mapping)

6. **Delegate to subagent `developer` (implementation phase):**
   - Create branch:
     ```bash
     git checkout -b <type>/<short-description>
     ```
     Branch types: `feature/` (from TASK/BRIEF), `fix/` (bug fixes), `refactor/`
   - Implement with granular commits:
     - Write code for one logical change
     - Commit with conventional message: `<type>(<scope>): <description>`
     - Repeat until done
   - If TASK exists: mark completed criteria in file
   - Push branch to remote:
     ```bash
     git push -u origin <branch-name>
     ```

7. **Report completion:**
    ```
    ✅ Implementation complete

    **Branch:** `<branch-name>`
    **Commits:**
    - `<hash>` <message>
    - `<hash>` <message>

    **Pushed to remote.**

    Next: create PR with auto-close syntax (see skill `tracker-github`).
    ```

## Source Priority

```
TASK file exists?
  ├── Yes → Use TASK (full spec with AC)
  └── No → BRIEF file exists?
            ├── Yes → Use BRIEF (implement from technical brief)
            └── No → Error: create spec or brief first
```

## Skills Integration

Use skill `git` for all git operations:
- Creating branches
- Making commits
- Pushing to remote
- Creating pull requests

Use skill `tracker-github` for tracker operations:
- Updating status to "implementation"
- Auto-close syntax for PR description

See skill references for status mapping and detailed instructions.

**Note:** Tracker operations are performed by main context before delegating to subagent.

## Important

- Code must be complete, no placeholders
- After implementation — mark completed criteria (if TASK exists)
- Use auto-close syntax in PR description (see skill `tracker-github`)
- When implementing from BRIEF: be more careful, AC less explicit
