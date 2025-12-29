---
description: Create task specification (TASK)
argument-hint: "<name> [description]"
allowed-tools: Read, Write, Glob, Grep
---

Use subagent `pm`.

## Task

Create task specification for Developer.

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty:
     - Ask user for task name and what needs to be done
     - Wait for response
   - Otherwise: use first word as `<name>`, rest as description

2. **Find context:**
   - Check `docs/briefs/` for related briefs
   - Study existing code if needed

3. **Create file:** `docs/tasks/TASK_<name>.md`
   - Context — why this is needed
   - Acceptance Criteria — checklist with `- [ ]`
   - Scope / Out of Scope — boundaries
   - Technical Notes — hints
   - Open Questions — unresolved questions

## File naming

- Use snake_case: `TASK_portfolio_display.md`
