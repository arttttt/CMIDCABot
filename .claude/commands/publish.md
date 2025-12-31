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
   - Parse title from first `#` heading (this becomes Issue title, no prefixes)
   - Read full content of the artifact file
   - Determine artifact type (TASK or BRIEF) for label selection

5. **Create GitHub Issue:**
   - **Language:** All Issue content MUST be in English
     - If artifact content is in Russian — translate to English
     - Translation should preserve technical meaning, not be literal
   - **Title:** Extract from first `#` heading in artifact file (no `[Task]` or `[Brief]` prefixes)
   - **Labels:**
     - For TASK file: `stage:spec`
     - For BRIEF file: `stage:brief`
   - **Body format:**
     ```
     <full artifact content, translated to English if needed>

     ---
     _Source: `<filepath>` (local, not yet in main)_
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
