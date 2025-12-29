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

2. **Read `ARCHITECTURE.md`** — mandatory before review

3. **Analyze code:**
   - Correctness
   - Architecture compliance
   - Security
   - Code quality

4. **Create file:** `docs/reviews/REVIEW_<name>.md`

## Name sanitization

If user input contains invalid characters:
- Replace spaces with `_`
- Remove special characters except `-` and `_`
- Convert to lowercase
- Example: "My Cool Feature!" → `my_cool_feature`

## File naming

- By component: `REVIEW_portfolio_handler.md`
- By feature: `REVIEW_dca_scheduling.md`
