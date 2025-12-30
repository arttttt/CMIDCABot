---
description: Create task specification (TASK)
argument-hint: "<name> [description]"
allowed-tools: Read, Write, Glob, Grep, mcp__github-official__create_issue, mcp__github-official__update_issue, mcp__github-official__get_issue, mcp__github-projects-local__list_projects, mcp__github-projects-local__get_project_items, mcp__github-projects-local__add_issue_to_project, mcp__github-projects-local__move_item_to_column, mcp__github-projects-local__get_project_fields
---

Use subagent `pm`.

## Task

Create task specification for Developer.

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - Ask user for task name and what needs to be done
     - Wait for response
   - Otherwise: use first word as `<name>`, rest as description

2. **Find context:**
   - Check `docs/briefs/` for related briefs
   - Study existing code if needed
   - **Extract Issue number** from BRIEF file if exists (`<!-- GitHub Issue: #123 -->`)

3. **Create file:** `docs/tasks/TASK_<name>.md`
   - Context — why this is needed
   - Acceptance Criteria — checklist with `- [ ]`
   - Scope / Out of Scope — boundaries
   - Technical Notes — hints
   - Open Questions — unresolved questions

4. **Find or create GitHub Issue:**
   - If related BRIEF has Issue number → use that Issue
   - If Issue exists:
     - Update labels: remove `stage:brief`, add `stage:spec`
     - Add comment with link to TASK file
   - If no Issue exists:
     - Create new Issue with title `[Spec] <name>`
     - Labels: `stage:spec` + type label
   - If MCP unavailable: show warning, continue without GitHub

5. **Update Project board:**
   - Find project "CMI DCA Bot"
   - Move issue to "Todo" column
   - If fails: show warning, continue

6. **Update TASK file:**
   - Add at the beginning: `<!-- GitHub Issue: #<number> -->`
   - Report: "Issue #<number> moved to Todo"

## GitHub Integration

```
Repository: arttttt/CMIDCABot
Project: CMI DCA Bot
Column: Todo
Labels: stage:spec (removes stage:brief)
```

## Name sanitization

If user input contains invalid characters:
- Replace spaces with `_`
- Remove special characters except `-` and `_`
- Convert to lowercase
- Example: "My Cool Feature!" → `my_cool_feature`

## File naming

- Use snake_case: `TASK_portfolio_display.md`
