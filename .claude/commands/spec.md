---
description: Create or enrich issue specification
argument-hint: "[id|description]"
allowed-tools: Read, Glob, Grep, Bash
---

Use subagent `planner`.

## Task

Create new issue or enrich existing one with full specification.

## Interaction Contract (MUST follow)

| Phase | Action | STOP until |
|-------|--------|------------|
| 1. Questions | List unclear points | User answers |
| 2. Confirmation | Summarize scope in 2-3 sentences | User says "ok" |
| 3. Create/Update | Issue via skill `beads` | — |

**Creating/updating issue without phases 1-2 is a critical violation.**

If everything is clear — skip phase 1, but NEVER skip confirmation.

## Algorithm

1. **Parse argument:**
   - Empty → ask "Describe the task:", wait for response
   - ID-like (2-4 chars or has `DCATgBot-` prefix) → enrich mode
   - Otherwise → treat as description, generate title

2. **Enrich mode:**
   - Get issue via skill `beads`
   - Show current title and description
   - Say: "Enriching issue `<id>` — <title>"
   - Research context, ask questions
   - Update issue description via skill `beads`

3. **Create mode:**
   - Generate short title from description (5-7 words max)
   - Research context (existing code, related issues via skill `beads`)
   - Ask clarifying questions if needed
   - Create issue via skill `beads`:
     - Title: generated from description
     - Type: task (or feature/bug based on context)
     - Priority: 2 (default)
     - Description: formatted per template below

4. **Issue description format:**
   ```markdown
   ## Context
   [Why this matters — 2-3 sentences]

   ## Acceptance Criteria
   - [ ] Criterion 1
   - [ ] Criterion 2

   ## Scope
   [What IS included]

   ## Out of Scope
   [What is NOT included]

   ## Technical Notes
   [Optional — implementation hints]
   ```

5. **Report result:**
   - Create: "Created: `<id>` — <title>"
   - Enrich: "Updated: `<id>` — <title>"
