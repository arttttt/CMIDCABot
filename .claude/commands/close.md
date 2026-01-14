---
description: Close task in tracker
argument-hint: "<task_id>"
allowed-tools: Read, Write, Edit, Glob, Bash
---

## Task

Close a task in tracker.

## Interaction Contract (MUST follow)

| Phase | Action | STOP until | Steps |
|-------|--------|------------|-------|
| 1. Find task | Locate task | - | 1-2 |
| 2. Confirm | Show what will be closed | User says "da" / "ok" / "yes" | 3 |
| 3. Execute | Close in tracker | - | 4-5 |

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

3. **Confirm with user:**
   - Show task ID to close
   - Wait for confirmation

4. **Close task in tracker:**
   - Use skill `beads` to close task with reason "Completed"
   - If error (task not found or already closed): report and stop

5. **Report result:**
   ```
   Task closed: <full_id>
   ```

## Tracker Integration

Use skill `beads` for closing task. See skill references for detailed instructions.

## Error Handling

- Task not found in tracker: report and stop
- Task already closed: report and stop

## ID Normalization Examples

| Input | Normalized (full_id) | short_id |
|-------|---------------------|----------|
| `abc` | `DCATgBot-abc` | `abc` |
| `DCATgBot-abc` | `DCATgBot-abc` | `abc` |
| `DCATgBot-9en` | `DCATgBot-9en` | `9en` |
| `9en` | `DCATgBot-9en` | `9en` |
