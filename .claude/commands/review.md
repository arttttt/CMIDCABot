---
description: Code review
argument-hint: "<issue_id>"
allowed-tools: Read, Glob, Grep, Bash
---

Use subagent `reviewer`.

## Task

Conduct code review and record findings.

## Resume Pattern

1. **Main context:** get issue via `beads`, determine scope
2. **Task(reviewer):** analyze code → return `{ related, unrelated, verdict }`
3. **Main context:** show verdict → ask about unrelated issues
4. **Task(reviewer, resume):** save comment, create issues if requested

## Algorithm

### Step 1: Get issue (main context)

- If `$ARGUMENTS` empty → ask "Which issue to review?"
- Normalize ID: add `DCATgBot-` prefix if missing
- Use skill `beads` to get issue details
- Determine scope: changed files from branch

### Step 2: Subagent — review

Prompt:
```
Issue: <id> - <title>
Branch: <branch>
Changed files: <list>

Read ARCHITECTURE.md and conventions.md first.

Review checklist:
- Correctness (logic, edge cases, error handling)
- Architecture (Clean Architecture compliance)
- Security (no secrets, input validation)
- Code quality (types, naming, structure)

Categorize: related vs unrelated.
Return: { status: "needs_confirmation", related, unrelated, verdict, summary }
DO NOT save comment yet.
```

### Step 3: Show verdict (main context)

```
## Review Complete
Status: <verdict>

### Related Findings
<related>

### Unrelated Issues
<unrelated>
---
Create issues for unrelated? (yes/no/select)
```

### Step 4: Resume subagent

```
User response: <yes/no/selection>
1. Save review as comment via skill `beads`
2. If approved: create issues for unrelated with `discovered-from` dependency
```

### Step 5: Report

**Needs work:**
```
Review complete. Status: Needs work.
Critical: [C1], [C2]...
Next: /fix <id>
```

**Approved:**
```
Review complete. Status: Approved.
Ready for merge.
```

## Findings Format (for comment)

```markdown
## Review

**Status:** Needs work | Approved
**Date:** <YYYY-MM-DD>

### Critical
- [C1] Description — `file:line`

### Should Fix
- [S1] Description — `file:line`

### Consider
- [N1] Description — `file:line`

### Verdict
<Summary>
```

## Important

- **Never skip verdict confirmation**
- **Resume preserves context** — no need to re-analyze
- **Never close issue** — developer closes after merge
- **Create issues for unrelated** — with `discovered-from` dependency
