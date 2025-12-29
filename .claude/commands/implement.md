---
description: Implement task from specification
argument-hint: "<task_name> | <file_path>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

Use subagent `developer`.

## Task

Implement functionality from specification.

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - List files in `docs/tasks/`
     - Ask user which task to implement
   - If file path provided: use it
   - If name provided: find `docs/tasks/TASK_<name>.md`

2. **Read specification**

3. **Create plan:**
   - Affected layers
   - Files to create/modify
   - Approach (steps)

4. **🚨 STOP — output plan and wait for confirmation** ("да", "ok", "yes")

5. **After confirmation:** implement code

## Important

- **NEVER** write code without plan confirmation
- Code must be complete, no placeholders
- After implementation — mark completed criteria
