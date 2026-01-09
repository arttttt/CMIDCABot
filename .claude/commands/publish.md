---
description: Publish artifact to tracker (create item, add to Project)
argument-hint: "<artifact_name>"
allowed-tools: Read, Edit, Glob, Bash
---

## Task

Publish an artifact (TASK or BRIEF) to tracker by creating a tracker item and adding it to the project board.

## Interaction Contract (MUST follow)

| Phase | Action | STOP until |
|-------|--------|------------|
| 1. Find artifact | Locate and show artifact to publish | — |
| 2. Confirm | Show what will be created (type, title) | User says "da" / "ok" / "yes" |
| 3. Publish | Create tracker item, update refs | — |

**Publishing without phase 2 confirmation is a critical violation.**

## Content Rules

When creating tracker items:
- **Title:** Short, descriptive (from artifact heading)
- **Description:** Summary only — NOT full artifact content
- **Language:** English only (translate if source is Russian)

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - Ask user for artifact name
     - Wait for response
   - Otherwise: use `$ARGUMENTS` as `<name>`

2. **Find artifact file** (priority order):
   - First check: `docs/drafts/TASK_<name>.md`
   - If not found: `docs/drafts/BRIEF_<name>.md`
   - If neither exists: report error and exit

3. **Check if already published:**
   - Read `docs/drafts/.refs.json`
   - Look for existing entry with this name
   - If found: report "Already published as item #<id>" and exit

4. **Extract metadata from file:**
   - Parse title from first `#` heading
   - Extract summary (first paragraph after heading)
   - Determine artifact type (TASK or BRIEF)
   - Determine if epic (has subtasks)

5. **Confirm with user:**
   - Show: artifact type, title, what will be created
   - Wait for confirmation

6. **Create tracker item(s):**
   - Use `beads` skill for issue creation
   - For epic: create parent first, then children with dependencies

7. **Update refs.json:**
   - Add entry mapping name to issue ID

8. **Cleanup:**
   - Delete published draft files

9. **Report result:**
   ```
   Published: <filename>
   - Item: #<id>
   - Type: <type>

   Deleted draft files.
   ```

## Tracker Integration

Use skill `beads` for all tracker operations:
- Creating tracker items
- Setting dependencies
- Priority mapping

See skill references for detailed instructions.

## Error Handling

- Artifact not found -> clear error message with search paths
- Already published -> show existing item ID
- Tracker unavailable -> cannot publish without tracker access

## Name Sanitization

Accept name as-is (should already be sanitized when artifact was created).
If file not found with exact name, try:
- lowercase
- with underscores instead of spaces
