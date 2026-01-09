# Rules

## Do

- Use `--json` flag for programmatic output
- Check `bd ready` before asking "what to work on?"
- Run `bd sync` at end of session
- Link discovered work with `discovered-from`
- Commit `.beads/issues.jsonl` with code changes

## Don't

- Create markdown TODO lists
- Use external issue trackers
- Duplicate tracking systems
- Commit `.beads/beads.db` (JSONL only)

## Session Protocol

1. Start: `bd ready` — find work
2. Claim: `bd update <id> --status in_progress`
3. Work: implement, test
4. Discover new work? Create with `discovered-from`
5. Complete: `bd close <id> --reason "Done"`
6. Sync: `bd sync` + `git push`
