# Review: DCATgBot-kvq

**Task:** DCATgBot-kvq - Fix publish command refs.json format and link logic
**Status:** Needs work
**Date:** 2026-01-10

## Acceptance Criteria Verification

| Criterion | Status | Evidence |
|-----------|--------|----------|
| refs.json uses object format | OK | `publish.md:81-90` documents format, `.refs.json` matches |
| Beads check for all artifact names | FAIL | Uses direct `bd` commands instead of skill reference |
| Prompt user when issue exists | OK | `publish.md:46-50` asks user to link or cancel |

## Findings

### Critical

- [C1] Step 3 uses direct `bd show` and `bd list` commands instead of skill `beads` reference. Commands in `.claude/commands/` should describe algorithm declaratively using skill references, not direct CLI commands. — `.claude/commands/publish.md:43-45`

### Should Fix

None.

### Consider

- [N1] Step 3 in `publish.md:45` searches only open issues. If the intent is to catch all existing issues (including closed), consider removing state filter. Current behavior is reasonable for most cases.

## Verdict

Critical issue found. Implementation uses direct `bd` commands instead of skill `beads` reference.

Fix required: Replace `bd show <name>`, `bd show DCATgBot-<name>`, `bd list --state open` with skill reference like "Use skill `beads` to search for existing issue by name".

Run /fix to address this issue.
