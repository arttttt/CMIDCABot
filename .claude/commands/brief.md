# /brief — Create Technical Brief

Create a technical brief for a feature or change.

## Arguments

- `<name>` — Brief identifier (optional, will prompt if not provided)

## Subagent

Use `analyst` subagent for execution.

## Interaction Contract

### Phase 1: Discovery

1. If `<name>` not provided, ask user for feature/change description
2. Explore codebase to understand technical context
3. Ask clarifying questions (max 3) to understand:
   - What problem needs to be solved
   - What constraints exist
   - What integrations are involved

### Phase 2: Draft

1. Present draft brief in chat for review:
   - Context
   - Goals
   - Scope
   - Out of Scope
   - Open Questions (for PM)
2. Wait for user feedback
3. Iterate if needed

### Phase 3: Save

1. After user confirms, save to `docs/drafts/BRIEF_<name>.md`
2. Create directory if not exists

## Output Format

```markdown
# Brief: [Feature/Change Name]

## Context
[Why this matters, background — 2-3 sentences]

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

## Output Location

`docs/drafts/BRIEF_<name>.md`

## Example

```
User: /brief wallet-connection
```

Analyst explores wallet-related code, asks about supported wallets, creates brief about implementing wallet connection feature.
