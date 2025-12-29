---
description: Check task status (briefs, specs, reviews)
argument-hint: "[name]"
allowed-tools: Read, Glob, Grep
---

## Task

Show which artifacts exist for a task.

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty:
     - Show overall statistics for `docs/`
   - Otherwise: search artifacts by name `<name>`

2. **Find artifacts:**
   - `docs/briefs/BRIEF_*<name>*.md`
   - `docs/tasks/TASK_*<name>*.md`
   - `docs/reviews/REVIEW_*<name>*.md`

3. **Output status:**

```
## Status: <name>

| Artifact | Status | File |
|----------|--------|------|
| Brief    | ✅/❌  | path |
| Spec     | ✅/❌  | path |
| Review   | ✅/❌  | path |

### Next step
[What needs to be done next]
```

## Without arguments — overall statistics

```
## Project Status

**Briefs:** X files
**Tasks:** Y files
**Reviews:** Z files

### Recent
- BRIEF_xxx.md (date)
- TASK_yyy.md (date)
```
