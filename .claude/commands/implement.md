---
description: Implement task from specification
argument-hint: "<task_name> | <file_path>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, mcp__github-official__update_issue, mcp__github-official__get_issue, mcp__github-official__add_issue_comment, mcp__github-projects-local__list_projects, mcp__github-projects-local__get_project_items, mcp__github-projects-local__move_item_to_column, mcp__github-projects-local__get_project_fields
---

Use subagent `developer`.

## Task

Implement functionality from specification.

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - List files in `docs/tasks/`
     - Ask user which task to implement
   - If file path provided: use it
   - If name provided: find `docs/tasks/TASK_<name>.md`

2. **Read specification**
   - **Extract Issue number** from TASK file (`<!-- GitHub Issue: #123 -->`)

3. **Create plan:**
   - Affected layers
   - Files to create/modify
   - Approach (steps)

4. **🚨 STOP — output plan and wait for confirmation** ("да", "ok", "yes")

5. **Update GitHub Issue (before coding):**
   - If Issue number found:
     - Update labels: remove `stage:spec`, add `stage:impl`
     - Move to "In Progress" column in project
     - Add comment: "Implementation started"
   - If MCP unavailable: show warning, continue

6. **After confirmation:** implement code

7. **After implementation:**
   - Mark completed criteria in TASK file
   - Remind: `При коммите используй "Closes #<number>" для автоматического закрытия issue`

## GitHub Integration

```
Repository: arttttt/CMIDCABot
Project: CMI DCA Bot
Column: In Progress
Labels: stage:impl (removes stage:spec)
```

## Important

- **NEVER** write code without plan confirmation
- Code must be complete, no placeholders
- After implementation — mark completed criteria
- Use `Closes #<number>` in commit message for auto-close
