---
description: Prepare technical brief for PM
argument-hint: "<name> [description]"
allowed-tools: Read, Write, Glob, Grep
---

Use subagent `analyst`.

## Task

Prepare technical brief to hand off to PM.

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

3. **Propose brief structure** — show user the plan

4. **Wait for confirmation** ("да", "ok", "yes")

5. **Create file:** `docs/briefs/BRIEF_<name>.md`

6. **Report result:**
   ```
   ✅ Created: docs/briefs/BRIEF_<name>.md

   Next: run `/publish <name>` to create GitHub Issue
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
