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

Use `beads` skill commands:

#### For Simple Task
```bash
bd create "Title" -t task -p 2 -d "Description from spec" --json
```

#### For Epic (no children yet)
```bash
bd create "Epic Title" -t epic -p 1 -d "Description" --json
```

#### For Epic with Children
```bash
# Create epic first
bd create "Epic Title" -t epic -p 1 -d "Description" --json
# Create each subtask
bd create "Subtask 1" -t task -p 2 --parent <epic-id> -d "AC list" --json
bd create "Subtask 2" -t task -p 2 --parent <epic-id> -d "AC list" --json
# Add dependencies between subtasks
bd dep add <task2-id> <task1-id> --type blocks
```

#### Update Existing
```bash
bd update <id> -d "New description from TASK" --json
```

### Step 5: Update refs.json

After creating issues, update `docs/drafts/.refs.json`:

```json
{
  "BRIEF_<name>.md": "<issue-id>",
  "TASK_<name>.md": "<issue-id>"
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
