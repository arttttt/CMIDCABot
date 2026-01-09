# /spec — Create Task Specification

Transform a brief or idea into actionable task specification.

## Arguments

- `<name>` — Spec identifier (optional, will prompt if not provided)

## Subagent

Use `pm` subagent for execution.

## Prerequisites

Before creating spec:
1. Check if `docs/drafts/BRIEF_<name>.md` exists — use as input
2. Check `docs/drafts/.refs.json` for existing related issues

## Interaction Contract

### Phase 1: Discovery

1. If `<name>` not provided, ask user
2. Read brief if exists (`docs/drafts/BRIEF_<name>.md`)
3. Ask clarifying questions to resolve ALL open questions from brief
4. Determine task type:
   - **Simple task** — single deliverable, clear scope
   - **Epic** — multiple subtasks needed

### Phase 2: Draft

1. Present draft specification:
   - For simple task: Context, Acceptance Criteria, Scope, Out of Scope
   - For epic: Context, Tasks list with dependencies, Scope, Out of Scope
2. Wait for user confirmation
3. Iterate if needed

### Phase 3: Save

1. After confirmation, save to `docs/drafts/TASK_<name>.md`
2. Create directory if not exists

## Output Format — Simple Task

```markdown
# Task: [Short Descriptive Title]

## Context
[Why this task exists — 2-3 sentences]

## Acceptance Criteria
- [ ] [Criterion 1 — must be verifiable]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Scope
[What IS included]

## Out of Scope
[What is explicitly NOT included]

## Technical Notes
[Implementation hints — optional]
```

## Output Format — Epic

```markdown
# Epic: [Feature Name]

## Context
[Why this epic exists — 2-3 sentences]

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

## Output Location

`docs/drafts/TASK_<name>.md`

## Notes

- NO open questions in output — all must be resolved in Phase 1
- Each acceptance criterion must be verifiable
- Dependencies only between tasks within same epic
