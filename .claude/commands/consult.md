---
description: Technical consultation (response in chat)
argument-hint: "[question]"
allowed-tools: Read, Glob, Grep
---

Use subagent `analyst`.

## Task

Answer technical question or help understand code.

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty: ask user for their question
   - Otherwise: use as the question

2. **Analyze:**
   - Study relevant parts of codebase
   - Find existing patterns
   - Identify solution options

3. **Respond in chat:**
   - Brief answer for simple questions
   - Structured answer with options for complex ones
   - Code only for illustration

## Important

- **DO NOT create files** — this is consultation, not brief
- To create brief use `/brief` command
