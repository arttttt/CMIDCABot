---
description: Prepare technical brief for PM
argument-hint: "<name> [description]"
allowed-tools: Read, Write, Glob, Grep, mcp__github-official__create_issue, mcp__github-official__update_issue, mcp__github-projects-local__list_projects, mcp__github-projects-local__add_issue_to_project, mcp__github-projects-local__get_project_fields
---

Use subagent `analyst`.

## Task

Prepare technical brief to hand off to PM.

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - Ask user for brief name and short description
     - Wait for response
   - Otherwise: use first word as `<name>`, rest as description

2. **Research context:**
   - Find related files in codebase
   - Identify technical constraints
   - Discover dependencies

3. **Propose brief structure** — show user the plan

4. **Wait for confirmation** ("да", "ok", "yes")

5. **Create file:** `docs/briefs/BRIEF_<name>.md`

6. **Create GitHub Issue:**
   - Title: `[Brief] <name>` — название из brief
   - Body: краткое описание + ссылка на BRIEF файл
   - Labels: `stage:brief` + type label если известен (`type:feature`, `type:bug`, etc.)
   - If MCP unavailable: show warning, continue without GitHub

7. **Add to Project:**
   - Find project "CMI DCA Bot" using `list_projects`
   - Get project fields to find "Status" field and "Backlog" option
   - Add issue to project in "Backlog" column
   - If fails: show warning, continue

8. **Update BRIEF file:**
   - Add at the beginning: `<!-- GitHub Issue: #<number> -->`
   - Report success: "Created Issue #<number>, added to Backlog"

## GitHub Integration

```
Repository: arttttt/CMIDCABot
Project: CMI DCA Bot
Column: Backlog
Labels: stage:brief
```

## Name sanitization

If user input contains invalid characters:
- Replace spaces with `_`
- Remove special characters except `-` and `_`
- Convert to lowercase
- Example: "My Cool Feature!" → `my_cool_feature`

## File naming

- Use snake_case: `BRIEF_jupiter_retry.md`
- No spaces or special characters
