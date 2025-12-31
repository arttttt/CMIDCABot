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

3. **Inherit GitHub Issue from BRIEF (if exists):**
   - Look for `docs/briefs/BRIEF_<name>.md`
   - If found, parse first line for `<!-- GitHub Issue: #xxx -->`
   - Store Issue number for use in created file

4. **Create file:** `docs/tasks/TASK_<name>.md`
   - **If Issue inherited from BRIEF:** prepend `<!-- GitHub Issue: #xxx -->` as first line
   - Content sections:
     - Context — why this is needed
     - Acceptance Criteria — checklist with `- [ ]`
     - Scope / Out of Scope — boundaries
     - Technical Notes — hints
     - Open Questions — unresolved questions

5. **Report result:**
   ```
   ✅ Created: docs/tasks/TASK_<name>.md

   [If Issue inherited:]
   Linked to GitHub Issue #xxx (from BRIEF)

   [If no BRIEF or BRIEF unpublished:]
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
