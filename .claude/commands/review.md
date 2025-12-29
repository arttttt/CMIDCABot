---
description: Code review of files or component
argument-hint: "<file_path> | <component_name>"
allowed-tools: Read, Glob, Grep, Write
---

Use subagent `reviewer`.

## Task

Conduct code review and create report.

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty:
     - Ask user what to review (file path or component name)
   - Otherwise: use as review scope

2. **Read `ARCHITECTURE.md`** — mandatory before review

3. **Analyze code:**
   - Correctness
   - Architecture compliance
   - Security
   - Code quality

4. **Create file:** `docs/reviews/REVIEW_<name>.md`

## File naming

- By component: `REVIEW_portfolio_handler.md`
- By feature: `REVIEW_dca_scheduling.md`
