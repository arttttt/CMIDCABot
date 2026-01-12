---
description: Code review
argument-hint: "<issue_id>"
allowed-tools: Read, Glob, Grep, Bash
---

Use subagent `reviewer`.

## Task

Conduct code review and record findings.

## Interaction Contract (MUST follow)

| Phase | Action | STOP until |
|-------|--------|------------|
| 1. Scope | Determine what to review | — |
| 2. Review | Analyze code, create findings | — |
| 3. Verdict | Show findings, ask about unrelated issues | User confirms |
| 4. Record | Save findings as comment to issue | — |

**Closing issue without user seeing the verdict is a critical violation.**

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty → ask "Which issue to review?"
   - Otherwise: use as issue ID

2. **Get issue details (main context):**
   - Normalize ID: if no `DCATgBot-` prefix, add it
   - Use skill `beads` to get issue details
   - Notify user: "Found issue: `<id>` - <title>"
   - Determine scope: find changed files from branch

3. **Read `ARCHITECTURE.md` and `conventions.md`** — mandatory before review

4. **Delegate to subagent `reviewer`:**
   - Analyze code against checklist:
     - Correctness (logic, edge cases, error handling)
     - Architecture (Clean Architecture compliance)
     - Security (no secrets, input validation)
     - Code quality (types, naming, structure)
   - Categorize findings:
     - **Related** — directly about task implementation
     - **Unrelated** — pre-existing issues, tech debt

5. **Handle unrelated findings:**
   - For each unrelated finding, ask user:
     > "Found unrelated issue: [description]. Create new issue?"
   - If yes: use skill `beads` to create issue with `discovered-from` dependency

6. **Save review as comment (main context):**
   - Use skill `beads` to add comment to issue with findings

7. **Report verdict:**

   **If Critical Issues (Needs work):**
   ```
   Review complete. Status: Needs work.

   Critical issues found:
   - [C1] Description
   - [C2] Description

   Run /fix <id> to address these issues.
   ```

   **If Approved:**
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
<Summary and next steps>
```

## Skills Integration

Use skill `beads` for:
- Getting issue details
- Adding review comment
- Creating discovered issues

## Important Rules

- **Never close issue** — developer closes after PR merge
- **Categorize findings** — related vs unrelated
- **Create issues for unrelated** — with `discovered-from` dependency
- **No fixes** — document only, developer fixes
