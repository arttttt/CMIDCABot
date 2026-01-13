---
name: close
description: "Close task and clean local artifacts. Use when the user invokes /close or asks to close a tracker issue and remove related files."
---

# Close Command

Follow `CLAUDE.md`, `conventions.md`, and `ARCHITECTURE.md`.

## Task

Close a task in tracker and clean up related local artifacts (refs.json entries, review files).

## Interaction Contract

| Phase | Action | STOP until | Steps |
|-------|--------|------------|-------|
| 1. Find task | Locate task and related artifacts | - | 1-3 |
| 2. Confirm | Show what will be closed and deleted | User says "da" / "ok" / "yes" | 4 |
| 3. Execute | Close in tracker, delete artifacts, update refs, commit | - | 5-9 |

Closing without phase 2 confirmation is a critical violation.

## Algorithm

1. **Check arguments:**
   - If empty: ask "Which task to close? Provide task ID."
   - Otherwise: use as task ID

2. **Normalize task ID:**
   - If ID does not contain prefix "DCATgBot-": add prefix
   - Store normalized ID as `<full_id>`
   - Store short ID (without prefix) as `<short_id>`

3. **Find related artifacts:**
   - Read `docs/drafts/.refs.json` (if missing, treat as `{}`)
   - Find entries where `issue_id` matches `<full_id>` or `<short_id>`
   - Collect entry keys and branch names
   - Find REVIEW files:
     - `docs/reviews/REVIEW_<name>.md`
     - `docs/reviews/REVIEW_<name>_v*.md`

4. **Confirm with user:**
   - Show task ID to close
   - Show entries to remove from refs.json
   - Show REVIEW files to delete
   - Wait for confirmation

5. **Close task in tracker:**
   - Use `beads` to close task with reason "Completed"
   - If not found/already closed: report and continue cleanup

6. **Delete REVIEW files:**
   - Remove each REVIEW file
   - Report deleted files

7. **Update refs.json:**
   - Remove matching entries
   - Keep file even if empty (`{}`)

8. **Report result:**
   ```
   Task closed: <full_id>

   Cleanup completed:
   - Removed refs.json entries: <list of names>
   - Deleted REVIEW files: <list of files>
   ```

9. **Commit and push cleanup:**
   - Use `git` skill for commit and push
   - Commit message: `chore: cleanup refs.json after closing <full_id>`

## Error Handling

- Task not found: warn but continue cleanup
- Task already closed: report and continue cleanup
- No refs.json entries: report
- No REVIEW files: report
- Push rejected: report error but consider cleanup successful
