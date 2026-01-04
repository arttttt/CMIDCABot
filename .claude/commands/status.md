---
description: Check task status (briefs, specs, reviews)
argument-hint: "[name]"
allowed-tools: Read, Glob, Grep
---

## Task

Show which artifacts exist for a task and their GitHub status.

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - Show overall statistics for `docs/`
   - Otherwise: search artifacts by name `<name>`

2. **Find artifacts:**
   - `docs/briefs/BRIEF_*<name>*.md`
   - `docs/tasks/TASK_*<name>*.md`
   - `docs/reviews/REVIEW_*<name>*.md`

3. **Extract GitHub Issue numbers:**
   - Parse `<!-- GitHub Issue: #123 -->` from each file
   - Collect unique Issue numbers

4. **Fetch GitHub data (if Issue found):**
   - Get Issue details: state, labels
   - Get Project status: which column
   - If MCP unavailable: show "GitHub: недоступен"

5. **Output status:**

```
## Status: <name>

| Artifact | Status | File | GitHub |
|----------|--------|------|--------|
| Brief    | ✅/❌  | path | #123   |
| Spec     | ✅/❌  | path | #123   |
| Review   | ✅/❌  | path | #123   |

**GitHub Issue:** #123 (open/closed)
**Project Column:** In Progress
**Labels:** stage:impl, type:feature, priority:high

### Next step
[What needs to be done next based on current stage]
```

## Without arguments — overall statistics

```
## Project Status

**Briefs:** X files
**Tasks:** Y files
**Reviews:** Z files

### GitHub Project Summary
| Column      | Count |
|-------------|-------|
| Backlog     | N     |
| Todo        | N     |
| In Progress | N     |
| Review      | N     |
| Done        | N     |

### Recent
- BRIEF_xxx.md (date) → #123
- TASK_yyy.md (date) → #124
```

## Tracker Integration

Use skill `tracker-github` for all GitHub operations:
- Getting Issue details
- Querying Project status

See skill references for detailed instructions.

## Stage Flow Reference

```
stage:brief  → Backlog     → /brief created
stage:spec   → Todo        → /spec created
stage:impl   → In Progress → /implement started
stage:review → Review      → /review created
(closed)     → Done        → PR merged
```
