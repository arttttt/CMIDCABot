# /review — Code Review

Review code changes for a task.

## Arguments

- `<path>` or `<id>` — File path, directory, or task ID (optional)

## Subagent

Use `reviewer` subagent for execution.

## Workflow

### Step 1: Determine Scope

1. If task `<id>` provided:
   - Get task details: `bd show <id> --json`
   - Find associated branch/changes
   - Review all files changed for that task

2. If `<path>` provided:
   - Review specified file or directory

3. If nothing provided:
   - Check current branch for uncommitted changes
   - Or ask user what to review

### Step 2: Perform Review

Review against checklist:
- Correctness (logic, edge cases, error handling)
- Architecture (Clean Architecture compliance)
- Security (no secrets, input validation)
- Code quality (types, naming, structure)

### Step 3: Categorize Findings

Separate findings into two categories:

#### Related Findings
Issues directly related to the task being reviewed:
- Implementation bugs
- Missing acceptance criteria
- Architecture violations in new code

#### Unrelated Findings
Issues discovered but not part of current task:
- Pre-existing bugs
- Tech debt in touched files
- Improvements outside scope

### Step 4: Save Review

Save review to `docs/reviews/REVIEW_<id-or-name>.md`

### Step 5: Handle Unrelated Findings

For each unrelated finding, ask user:
> "Found unrelated issue: [description]. Create new issue with `discovered-from` link?"

If yes:
```bash
bd create "Issue title" -t bug -p 2 -d "Description" --json
bd dep add <new-id> <current-task-id> --type discovered-from
```

### Step 6: Verdict

Based on related findings:

#### If Critical Issues (Status: Needs work)
```
Review complete. Status: Needs work.

Critical issues found that must be fixed:
- [C1] Description
- [C2] Description

Run /fix to address these issues.
```

Task remains open.

#### If Approved (Status: Approved or Approved with comments)
```
Review complete. Status: Approved.

Closing task <id>...
```

Close the task:
```bash
bd close <id> --reason "Review passed. Implemented: <summary>"
```

## Output Format

Review saved to `docs/reviews/REVIEW_<name>.md` with format from `reviewer` agent.

## Important Rules

- **Only close on approval** — needs work = task stays open
- **Categorize findings** — related vs unrelated
- **Create issues for unrelated** — with `discovered-from` link
- **No fixes** — document only, developer fixes

## Example

```
User: /review DCATgBot-abc

1. Task: "Setup wallet adapter"
2. Reviewing files:
   - src/infrastructure/wallet/adapter.ts
   - src/domain/wallet/types.ts

3. Related findings:
   - [S1] Missing error handling in connect()

4. Unrelated findings:
   - [N1] Old TODO in nearby file

5. Create issue for [N1]? [y/n]
   > y
   Created DCATgBot-xyz (discovered-from DCATgBot-abc)

6. Status: Approved with comments
7. Closing DCATgBot-abc...

Review saved to docs/reviews/REVIEW_DCATgBot-abc.md
```
