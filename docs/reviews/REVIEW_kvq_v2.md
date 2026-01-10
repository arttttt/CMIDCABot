# Review: DCATgBot-kvq (v2)

**Task:** DCATgBot-kvq - Fix publish command refs.json format and link logic
**Status:** Needs work
**Date:** 2026-01-10

## Acceptance Criteria Verification

| Criterion | Status | Evidence |
|-----------|--------|----------|
| refs.json uses object format | OK | `publish.md:81-89` documents format with `issue_id` and `relationship` |
| Beads check for all artifact names | OK | `publish.md:42-45` checks by short ID, full ID, and title match |
| Prompt user when issue exists | OK | `publish.md:46-50` asks user to link or cancel |

## Previous Finding Status

| Finding | Status | Notes |
|---------|--------|-------|
| [C1] Direct `bd` commands in step 3 | FIXED | Now uses "Use skill `beads` to search for existing issue" |
| [N1] Searching only open issues | UNCHANGED | Acceptable behavior |

## Findings

### Critical

None.

### Should Fix

- [S1] Step 7 line 74 still contains direct CLI command example: `bd edit <issue_id> --title "<title>" --body "<description>"`. While the step correctly references "Use `beads` skill", including the specific CLI invocation leaks implementation details into the command algorithm. Command specifications should be declarative. — `/Users/artem/Projects/DCATgBot/.claude/commands/publish.md:74`

### Consider

- [N1] (Carried from v1) Step 3 searches only open issues by title. Closed issues with same name would not be detected. Current behavior is reasonable — creating new issue for a closed topic is usually intentional.

## Verdict

The critical issue [C1] from v1 has been addressed. Step 3 now correctly uses skill reference instead of direct `bd show`/`bd list` commands.

One new finding [S1]: Step 7 contains residual direct CLI command. This is lower severity because:
1. The step does reference the skill first
2. It appears to be an illustrative example rather than the primary instruction

Recommendation: Remove line 74 or rephrase to "Use `beads` skill to update the issue title and description with artifact content" without the CLI example.

Overall the fix successfully addresses the original critical finding. The [S1] finding is minor and does not block approval for the original issue scope.

**Status changed from Needs work to conditional approval** — the core fix is complete. [S1] can be addressed in a follow-up or immediately before merge.
