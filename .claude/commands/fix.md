# /fix — Fix Review Findings

Fix issues found during code review.

## Arguments

- `<id>` — Task ID (optional, will use current task context)

## Subagent

Use `developer` subagent for execution.

## Workflow

### Step 1: Find Review

1. If `<id>` provided:
   - Look for `docs/reviews/REVIEW_<id>.md`

2. If not provided:
   - Check current branch name for task ID
   - Look for most recent review file

3. If no review found:
   - Error: "No review found. Run /review first."

### Step 2: Parse Findings

Extract findings that need fixing from review:
- **Critical (must fix)** — all items
- **Should Fix** — all items
- **Consider** — skip unless user requests

### Step 3: Plan Fixes

Present fix plan to user:
```
Findings to fix:

[C1] Missing null check in connect()
     Location: src/wallet/adapter.ts:42
     Fix: Add null guard before wallet access

[S1] No error logging
     Location: src/wallet/adapter.ts:58
     Fix: Add logger.error() call

Proceed with fixes? [y/n]
```

Wait for user approval.

### Step 4: Implement Fixes

1. Fix each issue in order (Critical first, then Should Fix)
2. Follow same coding standards as implementation
3. No new features — only fix what's documented

### Step 5: Commit Fixes

```bash
git add .
git commit -m "fix(<scope>): address review findings

Fixes:
- [C1] <description>
- [S1] <description>

Task: <task-id>"

git push
```

### Step 6: Request Re-review

After fixes complete:
```
Fixes complete for <task-id>.

Fixed:
- [C1] Missing null check
- [S1] No error logging

Run /review <task-id> to verify fixes.
```

## Important Rules

- **Fix documented issues only** — no scope creep
- **Plan before fixing** — get user approval
- **Re-review required** — always run /review after /fix
- **No new features** — fix mode only

## Output

```
Fixes applied for <task-id>.

Commit: <hash>
Files changed:
- src/path/file.ts

Next: Run /review <task-id> to verify.
```

## Example

```
User: /fix DCATgBot-abc

1. Found review: docs/reviews/REVIEW_DCATgBot-abc.md
2. Status: Needs work

3. Findings to fix:
   - [C1] Missing null check in connect()
   - [S1] No error logging

4. [User approves]

5. Fixing [C1]... done
6. Fixing [S1]... done

7. Committed: fix(wallet): address review findings

Next: Run /review DCATgBot-abc to verify.
```
