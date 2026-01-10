---
description: Prepare technical brief for PM
argument-hint: "<name> [description]"
allowed-tools: Read, Write, Glob, Grep
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

2. **Check beads for ID-like argument:**
   - Determine if `<name>` looks like an issue ID:
     - 2-4 characters without spaces (e.g., "9en", "abc")
     - OR contains "DCATgBot-" prefix (e.g., "DCATgBot-9en")
   - If ID-like:
     - Use `beads` skill: `bd show <name>` or `bd show DCATgBot-<name>`
     - If issue found:
       - Notify user: "Issue `<id>` already exists: <title>"
       - Suggest: "Use `/implement <id>` to implement or `/spec <id>` to create specification"
       - **STOP** — do not proceed with brief creation
     - If issue not found: continue to next step

3. **Find context:**
   - Check `docs/drafts/.refs.json` for existing issue with this name
   - If issue exists: use `beads` skill to get issue details (title, description)
   - Notify user: "Found issue <id>, using context from it"
   - If not found: continue without tracker context

4. **Research context:**
   - If issue found, use its title/description as primary context
   - Find related files in codebase
   - Identify technical constraints
   - Discover dependencies

5. **Execute Interaction Contract:**
   - Propose structure, wait for approval
   - Do NOT proceed to output until approved

6. **Create file:** `docs/drafts/BRIEF_<name>.md`

7. **Report result:**
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
