---
description: Code review of files or task
argument-hint: "<file_path> | <task_id>"
allowed-tools: Read, Write, Glob, Grep, Bash
---

Use subagent `reviewer`.

## Task

Conduct code review and create report.

## Interaction Contract (MUST follow)

| Phase | Action | STOP until |
|-------|--------|------------|
| 1. Scope | Determine what to review, show to user | — |
| 2. Review | Analyze code, create findings | — |
| 3. Verdict | Show findings, ask about unrelated issues | User responds to each unrelated finding |
| 4. Notify | If approved, notify ready for merge | — |

**Closing task without user seeing the verdict is a critical violation.**

## Algorithm

1. **Check arguments:**
   - If `$ARGUMENTS` is empty or whitespace only:
     - Ask user what to review (file path or task ID)
     - Wait for response
   - Otherwise: use as review scope

2. **Get task details if task ID provided (main context, before subagent):**
   - Determine if argument looks like an issue ID:
     - 2-4 characters without spaces (e.g., "9en", "abc")
     - OR contains "DCATgBot-" prefix (e.g., "DCATgBot-9en")
   - If ID-like:
     - Normalize ID: if no prefix, add "DCATgBot-" prefix
     - **Run `bd show DCATgBot-<suffix>` directly in main context**
     - If found: notify user "Found issue: `<id>` - <title>"
     - Pass issue context (title, description) inline to subagent
   - If not ID-like: continue (file path or branch case)

3. **Determine scope:**
   - If task ID provided: find changed files from branch
   - If file path provided: review that file/directory
   - If branch detected: review files changed on branch

4. **Read `ARCHITECTURE.md`** — mandatory before review

5. **Delegate to subagent `reviewer`:**
   - Analyze code against checklist:
     - Correctness (logic, edge cases, error handling)
     - Architecture (Clean Architecture compliance)
     - Security (no secrets, input validation)
     - Code quality (types, naming, structure)
   - Categorize findings:
     - **Related** — directly about task implementation
     - **Unrelated** — pre-existing issues, tech debt

6. **Save review:** `docs/reviews/REVIEW_<id-or-name>.md`

7. **Handle unrelated findings:**
   - For each unrelated finding, ask user:
     > "Found unrelated issue: [description]. Create new issue?"
   - If yes: use `beads` skill to create issue with `discovered-from` link

8. **Verdict based on related findings:**

   **If Critical Issues (Needs work):**
   ```
   Review complete. Status: Needs work.

   Critical issues found:
   - [C1] Description
   - [C2] Description

   Run /fix to address these issues.
   ```
   Task remains open.

   **If Approved:**
   ```
   Review complete. Status: Approved.

   Ready for merge. Task remains open until PR is merged.
   ```
   Do NOT close task — developer closes after merge.

## Output Format

Review saved to `docs/reviews/REVIEW_<name>.md`.

### Review File Structure

```markdown
# Review: <name>

**Task:** <task_id>
**Status:** Needs work | Approved
**Date:** <YYYY-MM-DD>

## Findings

### Critical
- [C1] Description — `file:line`

### Should Fix
- [S1] Description — `file:line`

### Consider
- [N1] Description — `file:line`

## Verdict
<Summary and next steps>
```

## Name Sanitization

If user input contains invalid characters:
- Replace spaces with `_`
- Remove special characters except `-` and `_`
- Convert to lowercase

## File Naming

- By task: `REVIEW_DCATgBot-abc.md`
- By component: `REVIEW_portfolio_handler.md`

## Versioning

For re-reviews after `/fix`:
- First review: `REVIEW_<name>.md`
- After fix: `REVIEW_<name>_v2.md`
- Subsequent: `REVIEW_<name>_v3.md`

Detect existing versions and increment automatically.

## Important Rules

- **Never close task** — developer closes after PR merge
- **Categorize findings** — related vs unrelated
- **Create issues for unrelated** — with `discovered-from` link
- **No fixes** — document only, developer fixes
