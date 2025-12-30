---
description: Publish artifact to GitHub (create Issue, add to Project)
argument-hint: "<artifact_name>"
allowed-tools: Read, Edit, Glob, mcp__github-official__create_issue, mcp__github-official__get_issue, mcp__github-projects-local__list_projects, mcp__github-projects-local__get_project_fields, mcp__github-projects-local__add_issue_to_project, mcp__github-projects-local__update_project_item_field
---

## Task

Publish an artifact (TASK or BRIEF) to GitHub by creating an Issue and adding it to the Project board.

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - Ask user for artifact name
     - Wait for response
   - Otherwise: use `$ARGUMENTS` as `<name>`

2. **Find artifact file** (priority order):
   - First check: `docs/tasks/TASK_<name>.md`
   - If not found: `docs/briefs/BRIEF_<name>.md`
   - If neither exists: report error and exit

3. **Check if already published:**
   - Read the artifact file
   - Look for `<!-- GitHub Issue: #<number> -->`
   - If found: report "Already published as Issue #<number>" and exit

4. **Extract metadata from file:**
   - Parse title/name from first heading
   - Extract brief description (first paragraph or TL;DR section)
   - Determine type label if present in file metadata

5. **Create GitHub Issue:**
   - For TASK file:
     - Title: `[Task] <name>`
     - Labels: `stage:spec`
   - For BRIEF file:
     - Title: `[Brief] <name>`
     - Labels: `stage:brief`
   - Body format:
     ```
     <brief description from file>

     📄 **Artifact:** `<filepath>`
     ```
   - If MCP unavailable: show error and exit

6. **Add to Project:**
   - Find project "CMI DCA Bot" using `list_projects`
   - Get project fields to find "Status" field ID and option IDs
   - Add issue to project
   - Set Status field:
     - For TASK → "Todo"
     - For BRIEF → "Backlog"
   - If fails: show warning, continue (Issue is still created)

7. **Update artifact file:**
   - Prepend `<!-- GitHub Issue: #<number> -->` as first line
   - Keep all existing content

8. **Report result:**
   ```
   ✅ Published: <filename>
   - Issue: #<number>
   - Project: <column>
   ```

## GitHub Integration

```
Repository: arttttt/CMIDCABot
Project: CMI DCA Bot
TASK → Column: Todo, Label: stage:spec
BRIEF → Column: Backlog, Label: stage:brief
```

## Error Handling

- Artifact not found → clear error message with search paths
- Already published → show existing Issue number
- MCP unavailable → cannot publish without GitHub access
- Project add fails → warn but keep Issue (can be added manually)

## Name sanitization

Accept name as-is (should already be sanitized when artifact was created).
If file not found with exact name, try:
- lowercase
- with underscores instead of spaces
