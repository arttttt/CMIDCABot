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
   - If `$ARGUMENTS` is empty or whitespace only:
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

4. **Report result:**
   ```
   ✅ Created: docs/tasks/TASK_<name>.md

   Next: run `/publish <name>` to create GitHub Issue
   ```

## Name sanitization

If user input contains invalid characters:
- Replace spaces with `_`
- Remove special characters except `-` and `_`
- Convert to lowercase
- Example: "My Cool Feature!" → `my_cool_feature`

## File naming

- Use snake_case: `TASK_portfolio_display.md`
