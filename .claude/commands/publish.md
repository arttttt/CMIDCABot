---
description: Publish artifact to tracker (create item, add to Project)
argument-hint: "<artifact_name>"
allowed-tools: Read, Edit, Glob, Bash
---

## Task

Publish an artifact (TASK or BRIEF) to tracker by creating a tracker item and adding it to the project board.

## Interaction Contract (MUST follow)

| Phase | Action | STOP until | Steps |
|-------|--------|------------|-------|
| 1. Find artifact | Locate and show artifact to publish | — | 1-5 |
| 2. Confirm | Show what will be created (type, title) | User says "da" / "ok" / "yes" | 6 |
| 3. Publish | Create tracker item, update refs | — | 7-10 |

**Publishing without phase 2 confirmation is a critical violation.**

## Content Rules

**Content Length Limit:** `MAX_DESCRIPTION_LENGTH = 10000` characters

When creating tracker items:
- **Title:** Short, descriptive (from artifact heading)
- **Description:**
  - If artifact content <= MAX_DESCRIPTION_LENGTH: publish full content
  - If artifact content > MAX_DESCRIPTION_LENGTH: create summary of exactly MAX_DESCRIPTION_LENGTH characters (preserve sentence boundaries, do not truncate mid-sentence)
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

3. **Check beads for existing issue:**
   - Use skill `beads` to search for existing issue by `<name>`:
     - Check if issue exists by short ID (`<name>`)
     - Check if issue exists by full ID with prefix (`DCATgBot-<name>`)
     - Search open issues and match by title
   - If issue found by any method:
     - Notify user: "Issue `<id>` already exists: <title>"
     - Ask: "Publish anyway (will link to existing), or cancel?"
     - If user confirms to publish anyway:
       - Save entry to `docs/drafts/.refs.json`:
         ```json
         {
           "<name>": {
             "issue_id": "<existing_id>",
             "relationship": "linked_to"
           }
         }
         ```
       - Continue to next step
     - If user declines: stop and suggest `/implement` or `/spec`
   - If issue not found: continue to next step

4. **Check refs.json for existing entry:**
   - Read `docs/drafts/.refs.json`
   - Look for existing entry with this name
   - If entry found:
     - If `relationship: "published_as_task"`: report "Already published as TASK #<id>" and exit (final state)
     - If `relationship: "published_as_brief"`:
       - Check if `docs/drafts/TASK_<name>.md` exists
       - If TASK exists: continue (will publish TASK and update relationship)
       - If TASK doesn't exist: report "Already published as BRIEF #<id>. Create TASK first with /spec" and exit
     - If `relationship: "linked_to"`: continue (will update existing issue)
   - If entry not found: continue (will create new issue)

5. **Extract metadata from file:**
   - Parse title from first `#` heading
   - Determine artifact type (TASK or BRIEF)
   - Determine if epic (has subtasks)
   - **Prepare description content:**
     - Measure full artifact content length (characters)
     - If content <= MAX_DESCRIPTION_LENGTH: use full content as description
     - If content > MAX_DESCRIPTION_LENGTH: create summary that fits within limit (preserve sentence boundaries)

6. **Confirm with user:**
   - Show: artifact type, title, what will be created
   - Wait for confirmation

7. **Create or update tracker item(s):**
   - If `published_as_brief` entry exists in refs.json:
     - Use `beads` skill to update existing issue with TASK content
   - If `linked_to` entry exists in refs.json:
     - Use `beads` skill to update existing issue title and body with artifact content
   - If no entry (new issue):
     - Use `beads` skill for issue creation
     - For epic: create parent first, then children with dependencies

8. **Update refs.json:**
   - Determine relationship value based on artifact type:
     - If publishing BRIEF: use `"published_as_brief"`
     - If publishing TASK: use `"published_as_task"`
   - If entry existed with `linked_to` or `published_as_brief`: update `relationship` to new value (note: `issue_id` remains unchanged)
   - If new entry: add mapping:
     ```json
     {
       "<name>": {
         "issue_id": "<id>",
         "relationship": "<published_as_brief|published_as_task>"
       }
     }
     ```

9. **Cleanup:**
   - Delete `docs/drafts/BRIEF_<name>.md` (if exists)
   - Delete `docs/drafts/TASK_<name>.md` (if exists)
   - Note: BRIEF deleted immediately — /spec gets context from issue via beads

10. **Report result:**
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
- Issue exists in beads -> ask user to confirm or cancel
- Tracker unavailable -> cannot publish without tracker access

## Name Sanitization

Accept name as-is (should already be sanitized when artifact was created).
If file not found with exact name, try:
- lowercase
- with underscores instead of spaces
