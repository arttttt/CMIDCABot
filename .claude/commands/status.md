---
description: Check task status (briefs, specs, reviews)
argument-hint: "[name]"
allowed-tools: Read, Glob, Grep
---

## Task

Show which artifacts exist for a task and their tracker status.

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - Show overall statistics for `docs/`
   - Otherwise: search artifacts by name `<name>`

2. **Find artifacts:**
   - `docs/briefs/BRIEF_*<name>*.md`
   - `docs/tasks/TASK_*<name>*.md`
   - `docs/reviews/REVIEW_*<name>*.md`

3. **Extract tracker item IDs:**
   - Parse tracker item link from each file (see skill `tracker-github` for link format)
   - Collect unique item IDs

4. **Fetch tracker data (if item found):**
   - Get item details: state, status
   - Get project status: which stage
   - If tracker unavailable: show "Tracker: недоступен"

5. **Output status:**

```
## Status: <name>

| Artifact | Status | File | Tracker |
|----------|--------|------|---------|
| Brief    | ✅/❌  | path | #123    |
| Spec     | ✅/❌  | path | #123    |
| Review   | ✅/❌  | path | #123    |

**Tracker Item:** #123 (open/closed)
**Status:** implementation
**Stage:** In Progress

### Next step
[What needs to be done next based on current stage]
```

## Without arguments — overall statistics

```
## Project Status

**Briefs:** X files
**Tasks:** Y files
**Reviews:** Z files

### Tracker Project Summary
| Status         | Count |
|----------------|-------|
| backlog        | N     |
| todo           | N     |
| implementation | N     |
| review         | N     |
| done           | N     |

### Recent
- BRIEF_xxx.md (date) → #123
- TASK_yyy.md (date) → #124
```

## Tracker Integration

Use skill `tracker-github` for all tracker operations:
- Getting item details
- Querying project status
- Link format and status mapping

See skill references for detailed instructions.

## Stage Flow Reference

See skill `tracker-github` for status mapping.
