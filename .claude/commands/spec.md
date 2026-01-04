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

3. **🚨 Clarify ALL ambiguities:**
   - List ALL unclear points as numbered questions
   - Ask user, wait for answers
   - Repeat if new questions arise from answers
   - Do NOT proceed until EVERY question is resolved

4. **Confirm scope:**
   - Summarize understanding back to user (2-3 sentences)
   - Wait for user confirmation ("да", "ok", "yes")

5. **Inherit tracker item from BRIEF (if exists):**
   - Look for `docs/briefs/BRIEF_<name>.md`
   - If found, parse first line for tracker item link (see skill `tracker-github` for link format)
   - Store item ID for use in created file

6. **Create file:** `docs/tasks/TASK_<name>.md`
   - **If item inherited from BRIEF:** prepend tracker item link as first line (see skill `tracker-github` for link format)
   - Content sections:
     - Context — why this is needed
     - Acceptance Criteria — checklist with `- [ ]`
     - Scope / Out of Scope — boundaries
     - Technical Notes — hints (optional)
   - **NO "Open Questions" section**

7. **Report result:**
   ```
   ✅ Created: docs/tasks/TASK_<name>.md

   [If item inherited:]
   Linked to tracker item #xxx (from BRIEF)

   [If no BRIEF or BRIEF unpublished:]
   Next: run `/publish <name>` to create tracker item
   ```

## Name sanitization

If user input contains invalid characters:
- Replace spaces with `_`
- Remove special characters except `-` and `_`
- Convert to lowercase
- Example: "My Cool Feature!" → `my_cool_feature`

## File naming

- Use snake_case: `TASK_portfolio_display.md`
