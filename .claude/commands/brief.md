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
| 1. Propose structure | Show planned brief sections to user | User says "да" / "ok" / "yes" |
| 2. Output | File per requirements below | — |

🚨 **Creating file without phase 1 approval is a critical violation.**

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - Ask user for brief name and short description
     - Wait for response
   - Otherwise: use first word as `<name>`, rest as description

2. **Research context:**
   - Find related files in codebase
   - Identify technical constraints
   - Discover dependencies

3. **Execute Interaction Contract:**
   - Propose structure, wait for approval
   - Do NOT proceed to output until approved

4. **Create file:** `docs/briefs/BRIEF_<name>.md`

5. **Report result:**
   ```
   ✅ Created: docs/briefs/BRIEF_<name>.md

   Next: run `/publish <name>` to create tracker item
   ```

## Name sanitization

If user input contains invalid characters:
- Replace spaces with `_`
- Remove special characters except `-` and `_`
- Convert to lowercase
- Example: "My Cool Feature!" → `my_cool_feature`

## File naming

- Use snake_case: `BRIEF_jupiter_retry.md`
- No spaces or special characters
