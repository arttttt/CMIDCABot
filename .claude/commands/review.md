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
   - **Extract tracker item ID** from found file (see skill `tracker-github` for link format)
   - Note source type (TASK/BRIEF) for review context

3. **Update tracker status** (main context, before delegating to subagent):
   - If tracker item found, update status to "review" (see skill `tracker-github` for status mapping)
   - If tracker unavailable: show warning, continue
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
   - Add tracker item link at the beginning (see skill `tracker-github` for link format)

7. **Report result:**
   - Summary of findings
   - Source type used: TASK / BRIEF / none
   - "Item #<number> moved to review" (if tracker item found)

## Tracker Integration

Use skill `tracker-github` for all tracker operations:
- Updating status to "review"
- Link format for artifact files

See skill references for status mapping and detailed instructions.

**Note:** Tracker operations are performed by main context before delegating to subagent.

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
