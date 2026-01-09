---
description: Check task status (tracker and local artifacts)
argument-hint: "[task_id]"
allowed-tools: Read, Glob, Grep, Bash
---

## Task

Show task status from tracker and related local artifacts.

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - Show overall project status
   - Otherwise: show specific task status

2. **Mode 1: Project Overview (no argument)**

   Use `beads` skill to get:
   - List open tasks
   - List ready tasks (not blocked)
   - List blocked tasks
   - List in-progress tasks

   Output:
   ```
   Project Status
   ==============

   Stats:
   - Open tasks: <count>
   - Ready to work: <count>
   - Blocked: <count>
   - In progress: <count>

   Ready Tasks (can start now):
   - <id1> - <title> (P<priority>)
   - <id2> - <title> (P<priority>)

   Blocked Tasks:
   - <id3> - <title>
     Blocked by: <blocker-id> (<blocker-status>)

   In Progress:
   - <id5> - <title>
   ```

3. **Mode 2: Specific Task (with argument)**

   Use `beads` skill to get task details and dependency tree.

   Also check local artifacts:
   - `docs/drafts/BRIEF_*<name>*.md`
   - `docs/drafts/TASK_*<name>*.md`
   - `docs/reviews/REVIEW_*<name>*.md`

   Output:
   ```
   Task: <id> - <title>
   Status: <status>
   Type: <type>
   Priority: <priority>

   Description:
   <description>

   Dependency Tree:
   <tree output>

   Local Artifacts:
   - Brief: <exists/none>
   - Spec: <exists/none>
   - Review: <exists/none>

   Next step:
   [What needs to be done based on current stage]
   ```

## Tracker Integration

Use skill `beads` for all tracker operations:
- Getting task details
- Listing tasks by status
- Getting dependency tree

See skill references for detailed instructions.

## Next Step Suggestions

Based on task status, suggest:
- `open` + no blocker -> `/implement <id>`
- `in_progress` -> continue implementation
- `in_progress` + code done -> `/review <id>`
- `needs_work` -> `/fix <id>`
