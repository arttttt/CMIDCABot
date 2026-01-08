---
description: Create task specification (TASK)
argument-hint: "<name> [description]"
allowed-tools: Read, Write, Glob, Grep
---

Use subagent `pm`.

## Task

Create task specification for Developer.

## Interaction Contract (MUST follow)

| Phase | Action | STOP until |
|-------|--------|------------|
| 1. Questions | List ALL unclear points as numbered list | User answers ALL questions |
| 2. Confirmation | Summarize scope in 2-3 sentences | User says "да" / "ok" / "yes" |
| 3. Output | File per requirements below | — |

🚨 **Creating file without completing phases 1-2 is a critical violation.**

If no questions needed (everything is clear) — skip to phase 2, but NEVER skip confirmation.

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - Ask user for task name and what needs to be done
     - Wait for response
   - Otherwise: use first word as `<name>`, rest as description

2. **Find context:**
   - Check `docs/briefs/` for related briefs
   - Study existing code if needed

3. **Execute Interaction Contract:**
   - Complete phases 1-2 (questions → confirmation)
   - Do NOT proceed to output until contract fulfilled

4. **Inherit tracker item from BRIEF (if exists):**
   - Look for `docs/briefs/BRIEF_<name>.md`
   - If found, parse first line for tracker item link (see skill `tracker-github` for link format)
   - Store item ID for use in created file

5. **Create file:** `docs/tasks/TASK_<name>.md`
   - **If item inherited from BRIEF:** prepend tracker item link as first line (see skill `tracker-github` for link format)
   - Content sections:
     - Context — why this is needed
     - Acceptance Criteria — checklist with `- [ ]`
     - Scope / Out of Scope — boundaries
     - Technical Notes — hints (optional)
   - **NO "Open Questions" section**

6. **Report result:**
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

## Output Boundaries

This command produces ONLY:
- **File:** `docs/tasks/TASK_<n>.md`
- **Chat:** questions, confirmations, result report

NO other side effects allowed:
- ❌ No tracker API calls
- ❌ No git operations
- ❌ No external service calls