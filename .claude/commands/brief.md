---
description: Prepare technical brief for PM
argument-hint: "<name> [description]"
allowed-tools: Read, Write, Glob, Grep, Bash
---

Use subagent `analyst`.

## Task

Prepare technical brief to hand off to PM.

## Interaction Contract (MUST follow)

| Phase | Action | STOP until |
|-------|--------|------------|
| 1. Propose structure | Show planned brief sections to user | User says "da" / "ok" / "yes" |
| 2. Output | File per requirements below | — |

**Creating file without phase 1 approval is a critical violation.**

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - Ask user for brief name and short description
     - Wait for response
   - Otherwise: use first word as `<name>`, rest as description

2. **Check beads task:**
   - Run `bd show <name>` via Bash tool
   - If task found (exit code 0):
     - Parse task title and description from output
     - Store as `beadsContext` for use in research
     - Notify user: "Found task <task-id>, using context from it"
   - If task not found (exit code non-zero):
     - Continue with normal flow (no beads context)

3. **Research context:**
   - If `beadsContext` available: use task title/description as primary context
   - Find related files in codebase
   - Identify technical constraints
   - Discover dependencies

4. **Execute Interaction Contract:**
   - Propose structure, wait for approval
   - Do NOT proceed to output until approved

5. **Create file:** `docs/drafts/BRIEF_<name>.md`

6. **Report result:**
   ```
   Created: docs/drafts/BRIEF_<name>.md

   Next: run `/publish <name>` to create tracker item
   ```

## Name Sanitization

If user input contains invalid characters:
- Replace spaces with `_`
- Remove special characters except `-` and `_`
- Convert to lowercase
- Example: "My Cool Feature!" -> `my_cool_feature`

## File Naming

- Use snake_case: `BRIEF_jupiter_retry.md`
- No spaces or special characters

## Output Format

```markdown
# Brief: [Feature/Change Name]

## Context
[Why this matters, background - 2-3 sentences]

## Goals
- [Goal 1]
- [Goal 2]

## Scope
[What IS included]

## Out of Scope
[What is explicitly NOT included]

## Open Questions
- [Question for PM to clarify]
- [Scope decision to be made]

## Technical References
- [Links to related files in codebase]
```

## Output Boundaries

This command produces ONLY:
- **File:** `docs/drafts/BRIEF_<name>.md`
- **Chat:** questions, confirmations, result report

NO other side effects allowed:
- No tracker API calls
- No git operations
- No external service calls
