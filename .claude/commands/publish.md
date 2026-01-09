# /publish — Publish Draft to Issue Tracker

Publish BRIEF or TASK drafts as issues in Beads.

## Arguments

- `<name>` — Draft identifier (optional, will list available drafts)

## Subagent

None — execute in main context using `beads` skill.

## Workflow

### Step 1: Find Drafts

1. If `<name>` not provided, list all drafts in `docs/drafts/`:
   - `BRIEF_*.md`
   - `TASK_*.md`
2. Ask user to select which to publish

### Step 2: Check Existing Issues

Read `docs/drafts/.refs.json` to check if draft already has linked issue.

### Step 3: Determine Action

Based on what exists:

| Has BRIEF | Has TASK | Prior Issue | Action |
|-----------|----------|-------------|--------|
| Yes | No | No | Create task/epic (no children) |
| No | Yes | No | Create task OR epic with children + deps |
| No | Yes | Yes | Create children under existing OR update description |
| Yes | Yes | No | Create epic with children from TASK |
| Yes | Yes | Yes | Update existing with TASK details |

### Step 4: Create Issues

Use `beads` skill to create issues:

#### For Simple Task
Create task with title, description from spec, priority 2.

#### For Epic (no children yet)
Create epic with title, description, priority 1.

#### For Epic with Children
1. Create epic first
2. Create each subtask with parent reference to epic
3. Add `blocks` dependencies between subtasks in order

#### Update Existing
Update issue description with new content from TASK.

### Step 5: Update refs.json

After creating issues, update `docs/drafts/.refs.json`:

```json
{
  "<name>": {
    "issue_id": "<id>",
    "type": "epic|task"
  }
}
```

### Step 6: Cleanup

After successful publish:
1. Delete `docs/drafts/BRIEF_<name>.md` (if exists)
2. Delete `docs/drafts/TASK_<name>.md` (if exists)
3. Keep `.refs.json` updated

## Output

Report to user:
- Created issue IDs
- Links/dependencies created
- Files deleted

## Example Flow

```
User: /publish wallet-connection

1. Found: BRIEF_wallet-connection.md, TASK_wallet-connection.md
2. No prior issue in .refs.json
3. TASK defines epic with 3 subtasks
4. Creating:
   - Epic: DCATgBot-abc (Wallet Connection)
   - Task: DCATgBot-def (Setup wallet adapter) - parent: abc
   - Task: DCATgBot-ghi (Connect flow) - parent: abc, blocked by: def
   - Task: DCATgBot-jkl (Disconnect handling) - parent: abc, blocked by: ghi
5. Updated .refs.json
6. Deleted drafts

Done. Epic DCATgBot-abc created with 3 subtasks.
```
