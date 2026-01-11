---
description: Close task and cleanup related artifacts (refs.json entries, REVIEW files)
argument-hint: "<task_id>"
allowed-tools: Read, Write, Edit, Glob, Bash
---

## Task

Close a task in tracker and cleanup all related local artifacts (refs.json entries, review files).

## Interaction Contract (MUST follow)

| Phase | Action | STOP until | Steps |
|-------|--------|------------|-------|
| 1. Find task | Locate task and related artifacts | - | 1-3 |
| 2. Confirm | Show what will be closed and deleted | User says "da" / "ok" / "yes" | 4 |
| 3. Execute | Close in tracker, delete artifacts, update refs, commit | - | 5-9 |

**Closing without phase 2 confirmation is a critical violation.**

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - Ask: "Which task to close? Provide task ID."
     - Wait for response
   - Otherwise: use `$ARGUMENTS` as task ID

2. **Normalize task ID:**
   - If ID does not contain prefix "DCATgBot-":
     - Add prefix: `DCATgBot-<id>`
   - Store normalized ID as `<full_id>`
   - Store short ID (without prefix) as `<short_id>`

3. **Find related artifacts:**
   - Read `docs/drafts/.refs.json` (if file doesn't exist, treat as empty `{}`)
   - Find all entries where `issue_id` matches `<full_id>` or `<short_id>`:
     - Check both exact match and with/without prefix
   - For each found entry, collect:
     - Entry key (name)
     - Branch name (if present)
   - Find REVIEW files:
     - Glob `docs/reviews/REVIEW_<name>.md` (base file)
     - Glob `docs/reviews/REVIEW_<name>_v*.md` (versioned files)

4. **Confirm with user:**
   - Show task ID to close
   - Show entries to remove from refs.json
   - Show REVIEW files to delete
   - Wait for confirmation

5. **Close task in tracker:**
   - Use skill `beads` to close task with reason "Completed"
   - If error (task not found or already closed): report and continue cleanup

6. **Delete REVIEW files:**
   - For each REVIEW file found in step 3:
     - Delete file using Bash `rm`
   - Report deleted files

7. **Update refs.json:**
   - Using entries found in step 3, remove them from refs.json
   - Write updated refs.json
   - If refs.json becomes empty (`{}`), keep the empty object

8. **Report result:**
   ```
   Task closed: <full_id>

   Cleanup completed:
   - Removed refs.json entries: <list of names>
   - Deleted REVIEW files: <list of files>
   ```

9. **Commit and push cleanup:**
   - Stage changes: `git add -A`
   - Commit: `chore: cleanup refs.json after closing <full_id>`
   - Push to current branch
   - If push fails: report error but consider cleanup successful

## Tracker Integration

Use skill `beads` for closing task. See skill references for detailed instructions.

## Error Handling

- Task not found in tracker: warn but continue cleanup (artifacts may exist for stale entries)
- Task already closed: report and continue cleanup
- No refs.json entries found: report "No refs.json entries for this task"
- No REVIEW files found: report "No REVIEW files to delete"
- Git push rejected: report error but consider cleanup successful (changes are committed locally)

## ID Normalization Examples

| Input | Normalized (full_id) | short_id |
|-------|---------------------|----------|
| `abc` | `DCATgBot-abc` | `abc` |
| `DCATgBot-abc` | `DCATgBot-abc` | `abc` |
| `DCATgBot-9en` | `DCATgBot-9en` | `9en` |
| `9en` | `DCATgBot-9en` | `9en` |
