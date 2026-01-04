---
description: Implement task from specification
argument-hint: "<task_name> | <file_path>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Use subagent `developer`.

## Task

Implement functionality from specification or brief.

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
   - **Extract Issue number** (`<!-- GitHub Issue: #123 -->`)
   - Note source type: TASK or BRIEF

4. **Create plan:**
   - Branch name (`feature/` for TASK/BRIEF, `fix/` for bug fixes)
   - Affected layers
   - Files to create/modify
   - Approach (steps)
   - If from BRIEF: note that AC may be less detailed

5. **🚨 STOP — output plan and wait for confirmation** ("да", "ok", "yes")

6. **Update GitHub Issue** (main context, before delegating to subagent):
   - If Issue number found, use MCP tools:
     - Update labels: remove label, add `stage:impl`
     - Move to "In Progress" column in project
   - This is done by main context, NOT by subagent

7. **Delegate to subagent** for implementation:
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

8. **Report completion:**
    ```
    ✅ Implementation complete

    **Branch:** `<branch-name>`
    **Commits:**
    - `<hash>` <message>
    - `<hash>` <message>

    **Pushed to remote.**

    Next: create PR with `Closes #<number>` in description.
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

Use skill `tracker-github` for GitHub Issue operations:
- Updating labels (stage:impl)
- Moving to "In Progress" column

See skill references for conventions and detailed instructions.

**Note:** GitHub operations (labels, project column) are performed by main context via MCP before delegating to subagent.

## Plan Format

```markdown
## Implementation Plan

**Branch:** `feature/short-description`
**Source:** `docs/tasks/TASK_xxx.md` (Issue #123)

**Affected layers:**
- [layer]: [changes]

**Files to create/modify:**
- `path/to/file.ts` — [purpose]

**Approach:**
1. [Step 1]
2. [Step 2]

Подтверждаешь?
```

## Important

- **NEVER** write code without plan confirmation
- Code must be complete, no placeholders
- After implementation — mark completed criteria (if TASK exists)
- Use `Closes #<number>` in PR description for auto-close
- When implementing from BRIEF: be more careful, AC less explicit
