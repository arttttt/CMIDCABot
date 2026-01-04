---
name: git
description: Git version control operations. Use for creating branches, making commits, pushing code, and creating pull requests. Use when implementing features, fixing bugs, or preparing code for review.
allowed-tools: Bash, mcp__github-official__create_pull_request, mcp__github-official__get_pull_request, mcp__github-official__update_pull_request
---

# Git Operations

## Configuration

- **Repository:** arttttt/CMIDCABot

## When to Use

- Creating feature/fix/refactor branches
- Making commits with conventional commit messages
- Pushing branches to remote
- Creating pull requests

## Quick Reference

### Create Branch
```bash
git checkout -b <type>/<short-description>
```
Types: `feature/`, `fix/`, `refactor/`

### Commit
```bash
git commit -m "<type>(<scope>): <description>"
```

### Push
```bash
git push -u origin <branch-name>
```

### Create PR
Use MCP tool `create_pull_request` with:
- `owner`: from Configuration
- `repo`: from Configuration
- `title`: descriptive title
- `body`: include `Closes #<issue-number>` if applicable
- `head`: current branch name
- `base`: main

## Detailed References

- See `references/branching.md` for branch naming conventions
- See `references/commits.md` for commit message format
