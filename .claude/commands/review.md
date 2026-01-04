---
description: Code review of files or component
argument-hint: "<file_path> | <component_name>"
allowed-tools: Read, Write, Glob, Grep
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

3. **Update GitHub Issue** (main context, before delegating to subagent):
   - If Issue number found, use MCP tools:
     - Update labels: remove `stage:impl`, add `stage:review`
     - Move to "Review" column in project
   - If MCP unavailable: show warning, continue
   - **Note:** This is done by main context, NOT by subagent

4. **Read `ARCHITECTURE.md`** — mandatory before review

5. **Analyze code:**
   - Correctness
   - Architecture compliance
   - Security
   - Code quality
   - **If source is BRIEF:** note that AC may be implicit, focus on technical requirements from brief
   - **If no source found:** review against ARCHITECTURE.md only, warn about missing requirements

6. **Create file:** `docs/reviews/REVIEW_<name>.md`
   - Add at the beginning: `<!-- GitHub Issue: #<number> -->` (if found)

7. **Report result:**
   - Summary of findings
   - Source type used: TASK / BRIEF / none
   - "Issue #<number> moved to Review" (if Issue found)

## Tracker Integration

Use skill `tracker-github` for all GitHub operations:
- Updating labels (stage:review)
- Moving to "Review" column

See skill references for detailed instructions.

**Note:** GitHub operations (labels, project column) are performed by main context via MCP before delegating to subagent.

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
