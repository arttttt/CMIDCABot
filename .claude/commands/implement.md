---
description: Implement task from specification
argument-hint: "<task_name> | <file_path>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, mcp__github-official__update_issue, mcp__github-official__get_issue, mcp__github-official__add_issue_comment, mcp__github-projects-local__list_projects, mcp__github-projects-local__get_project_items, mcp__github-projects-local__move_item_to_column, mcp__github-projects-local__get_project_fields
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

6. **Start work** (after confirmation, before any code):
   - Update GitHub Issue (if Issue number found):
     - Remove `stage:spec` or `stage:brief` label
     - Add `stage:impl` label
     - Move to "In Progress" column in project
     - If MCP unavailable: show warning, continue
   - Create branch:
     ```bash
     git checkout -b <type>/<short-description>
     ```
     Branch types: `feature/` (from TASK/BRIEF), `fix/` (bug fixes), `refactor/`

7. **Implement with granular commits:**
   - Write code for one logical change
   - Commit with conventional message: `<type>(<scope>): <description>`
   - Repeat until done

8. **After implementation:**
   - If TASK exists: mark completed criteria in file

9. **Push branch to remote:**
    ```bash
    git push -u origin <branch-name>
    ```

10. **Report completion:**
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

## GitHub Integration

```
Repository: arttttt/CMIDCABot
Project: CMI DCA Bot
Column: In Progress
Labels: stage:impl (removes stage:spec or stage:brief)
```

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
