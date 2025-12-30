---
description: Code review of files or component
argument-hint: "<file_path> | <component_name>"
allowed-tools: Read, Write, Glob, Grep, mcp__github-official__update_issue, mcp__github-official__get_issue, mcp__github-official__add_issue_comment, mcp__github-projects-local__list_projects, mcp__github-projects-local__get_project_items, mcp__github-projects-local__move_item_to_column, mcp__github-projects-local__get_project_fields
---

Use subagent `reviewer`.

## Task

Conduct code review and create report.

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - Ask user what to review (file path or component name)
   - Otherwise: use as review scope

2. **Find related source file (priority order):**
   - First: `docs/tasks/TASK_*<name>*.md` — full specification
   - Fallback: `docs/briefs/BRIEF_*<name>*.md` — technical brief
   - **Extract Issue number** from found file (`<!-- GitHub Issue: #123 -->`)
   - Note source type (TASK/BRIEF) for review context

3. **Read `ARCHITECTURE.md`** — mandatory before review

4. **Analyze code:**
   - Correctness
   - Architecture compliance
   - Security
   - Code quality
   - **If source is BRIEF:** note that AC may be implicit, focus on technical requirements from brief
   - **If no source found:** review against ARCHITECTURE.md only, warn about missing requirements

5. **Create file:** `docs/reviews/REVIEW_<name>.md`
   - Add at the beginning: `<!-- GitHub Issue: #<number> -->` (if found)

6. **Update GitHub Issue:**
   - If Issue number found:
     - Update labels: remove `stage:impl`, add `stage:review`
     - Move to "Review" column in project
     - Add comment with link to REVIEW file and summary
   - If MCP unavailable: show warning, continue

7. **Report result:**
   - Summary of findings
   - Source type used: TASK / BRIEF / none
   - "Issue #<number> moved to Review" (if Issue found)

## GitHub Integration

```
Repository: arttttt/CMIDCABot
Project: CMI DCA Bot
Column: Review
Labels: stage:review (removes stage:impl)
```

## Name sanitization

If user input contains invalid characters:
- Replace spaces with `_`
- Remove special characters except `-` and `_`
- Convert to lowercase
- Example: "My Cool Feature!" → `my_cool_feature`

## File naming

- By component: `REVIEW_portfolio_handler.md`
- By feature: `REVIEW_dca_scheduling.md`

## Versioning

For re-reviews after `/fix`:
- First review: `REVIEW_<name>.md`
- After fix: `REVIEW_<name>_v2.md`
- Subsequent: `REVIEW_<name>_v3.md`

Detect existing versions and increment automatically.
