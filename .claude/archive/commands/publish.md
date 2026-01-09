---
description: Publish artifact to tracker (create item, add to Project)
argument-hint: "<artifact_name>"
allowed-tools: Read, Edit, Glob
---

## Task

Publish an artifact (TASK or BRIEF) to tracker by creating a tracker item and adding it to the project board.

## ⚠️ Critical: Follow Skill Contract

Before creating/updating tracker items, read the **Content Contract** in skill `tracker-github`.

Key requirements:
- Item body = summary only (NOT full content)
- Full content = added separately (as comment in GitHub)
- All text must be in English

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

3. **Check for linked tracker item (TASK only):**
   - If artifact is TASK:
     - Check for corresponding BRIEF: `docs/briefs/BRIEF_<name>.md`
     - If BRIEF has tracker item link (see skill `tracker-github` for link format):
       - Extract item ID — this is the linked tracker item
       - Go to step 5b (publish TASK to existing item)
   - Otherwise: continue to step 4

4. **Check if already published:**
   - Read the artifact file
   - Look for tracker item link (see skill `tracker-github` for link format)
   - If found: report "Already published as item #<number>" and exit

5. **Extract metadata from file:**
   - Parse title from first `#` heading
   - Extract summary (first paragraph after heading)
   - Read full artifact content
   - Determine artifact type (TASK or BRIEF)
   - **Apply skill Content Contract** for language and format requirements

6. **Create new tracker item** (skip if publishing TASK to existing item):
   - **Follow skill Content Contract** for title, body, and language
   - Set status:
     - For TASK file: "todo"
     - For BRIEF file: "backlog"

7. **Update existing tracker item** (only when publishing TASK to item from BRIEF):
   - Do NOT modify item body
   - Update status from "backlog" to "todo" (see skill `tracker-github` for status mapping)

8. **Add full artifact content:**
   - **Follow skill Content Contract** for method and format
   - This is where full content goes (NOT in item body)

9. **Add to project board:**
   - See skill `tracker-github` for project operations
   - Set status:
     - For TASK: "todo"
     - For BRIEF: "backlog"
   - If fails: show warning, continue (item is still created)

10. **Update artifact file:**
    - Prepend tracker item link as first line (see skill `tracker-github` for link format)
    - Keep all existing content

11. **Report result:**
   ```
   ✅ Published: <filename>
   - Item: #<number>
   - Status: <status>
   ```

## Tracker Integration

Use skill `tracker-github` for all tracker operations:
- Creating tracker items
- Adding to project board
- Setting status
- Link format and comment format

See skill references for detailed instructions.

## Error Handling

- Artifact not found → clear error message with search paths
- Already published → show existing item number
- Tracker unavailable → cannot publish without tracker access
- Project add fails → warn but keep item (can be added manually)

## Name sanitization

Accept name as-is (should already be sanitized when artifact was created).
If file not found with exact name, try:
- lowercase
- with underscores instead of spaces
