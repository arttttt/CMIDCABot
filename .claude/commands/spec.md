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
| 2. Confirmation | Summarize scope in 2-3 sentences | User says "da" / "ok" / "yes" |
| 3. Output | File per requirements below | — |

**Creating file without completing phases 1-2 is a critical violation.**

If no questions needed (everything is clear) — skip to phase 2, but NEVER skip confirmation.

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - Ask user for task name and what needs to be done
     - Wait for response
   - Otherwise: use first word as `<name>`, rest as description

2. **Check beads for ID-like argument (main context, before subagent):**
   - Determine if `<name>` looks like an issue ID:
     - 2-4 characters without spaces (e.g., "9en", "abc")
     - OR contains "DCATgBot-" prefix (e.g., "DCATgBot-9en")
   - If ID-like:
     - Normalize ID: if no prefix, add "DCATgBot-" prefix
     - **Use skill `beads` to get issue details**
     - If issue found:
       - Notify user: "Found issue: `<id>` - <title>"
       - Pass issue context (title, description) inline to subagent
     - If issue not found: continue without tracker context

3. **Find context:**
   - Check `docs/drafts/.refs.json` for existing issue with this name
   - If issue exists: use `beads` skill to get issue details (title, description)
   - Study existing code if needed

4. **Execute Interaction Contract:**
   - Complete phases 1-2 (questions -> confirmation)
   - Do NOT proceed to output until contract fulfilled

5. **Create file:** `docs/drafts/TASK_<name>.md`
   - Content sections:
     - Context — why this is needed
     - Acceptance Criteria — checklist with `- [ ]`
     - Scope / Out of Scope — boundaries
     - Technical Notes — hints (optional)
   - **NO "Open Questions" section**

6. **Report result:**
   ```
   Created: docs/drafts/TASK_<name>.md

   Next: run `/publish <name>` to create tracker item
   ```

## Name Sanitization

If user input contains invalid characters:
- Replace spaces with `_`
- Remove special characters except `-` and `_`
- Convert to lowercase
- Example: "My Cool Feature!" -> `my_cool_feature`

## File Naming

- Use snake_case: `TASK_portfolio_display.md`

## Output Format — Simple Task

```markdown
# Task: [Short Descriptive Title]

## Context
[Why this task exists - 2-3 sentences]

## Acceptance Criteria
- [ ] [Criterion 1 - must be verifiable]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Scope
[What IS included]

## Out of Scope
[What is explicitly NOT included]

## Technical Notes
[Implementation hints - optional]
```

## Output Format — Epic

```markdown
# Epic: [Feature Name]

## Context
[Why this epic exists - 2-3 sentences]

## Tasks

### <name>-1 — [Subtask 1 Title]
**Depends on:** none
- [ ] [AC 1]
- [ ] [AC 2]

### <name>-2 — [Subtask 2 Title]
**Depends on:** <name>-1
- [ ] [AC 1]
- [ ] [AC 2]

## Scope
[What IS included in entire epic]

## Out of Scope
[What is explicitly NOT included]
```

## Output Boundaries

This command produces ONLY:
- **File:** `docs/drafts/TASK_<name>.md`
- **Chat:** questions, confirmations, result report

NO other side effects allowed:
- No tracker API calls
- No git operations
- No external service calls
