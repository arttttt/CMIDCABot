# /implement — Implement Task

Implement a task from the issue tracker.

## Arguments

- `<id>` — Issue ID (optional, will show ready tasks)

## Subagent

Use `developer` subagent for execution.

## Workflow

### Step 1: Select Task

1. If `<id>` not provided:
   ```bash
   bd ready --json
   ```
   Show list of ready tasks, ask user to select

2. If `<id>` provided:
   ```bash
   bd show <id> --json
   ```
   Verify task exists and is ready (not blocked)

### Step 2: Claim Task

Update status to in_progress:
```bash
bd update <id> --status in_progress --json
```

### Step 3: Understand Requirements

1. Read task description and acceptance criteria
2. If task has parent epic, read epic context:
   ```bash
   bd show <parent-id> --json
   ```
3. Explore relevant codebase areas

### Step 4: Plan Implementation

1. Present implementation plan to user:
   - Files to create/modify
   - Key changes
   - Order of implementation
2. Wait for user approval before coding

### Step 5: Implement

1. Create branch using `git` skill:
   ```bash
   git checkout -b beads/<task-id>-<short-description>
   ```

2. Implement according to plan:
   - Follow project conventions (`conventions.md`)
   - Follow architecture (`ARCHITECTURE.md`)
   - No placeholders — working code only

3. Commit changes:
   ```bash
   git add .
   git commit -m "feat(<scope>): <description>

   Implements <task-id>"
   ```

4. Push branch:
   ```bash
   git push -u origin <branch-name>
   ```

### Step 6: Report Completion

1. Report to user:
   - What was implemented
   - Files changed
   - Branch name
2. DO NOT close task — wait for review

## Important Rules

- **Do NOT close task** — reviewer will close after approval
- **Do NOT merge** — PR review required
- **Ask if unclear** — better to clarify than assume
- **Plan first** — never code without user approval

## Output

After implementation:
```
Implementation complete for <task-id>.

Branch: beads/<task-id>-<description>
Files changed:
- src/path/file1.ts (new)
- src/path/file2.ts (modified)

Next: Run /review to check implementation.
```

## Example

```
User: /implement DCATgBot-abc

1. Task: "Setup wallet adapter"
2. Claiming task... done
3. Plan:
   - Create src/infrastructure/wallet/adapter.ts
   - Add WalletAdapter interface to domain
   - Update dependency injection
4. [User approves]
5. Implementing...
6. Branch: beads/DCATgBot-abc-wallet-adapter
7. Ready for review.
```
