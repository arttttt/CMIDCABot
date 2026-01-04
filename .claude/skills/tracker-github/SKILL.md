---
name: tracker-github
description: GitHub Issues and Projects integration. Use for creating/updating issues, managing labels, adding to project boards, and tracking task status. Use when publishing artifacts, updating task status, or checking project state.
allowed-tools: mcp__github-official__create_issue, mcp__github-official__get_issue, mcp__github-official__add_issue_comment, mcp__github-official__update_issue, mcp__github-projects-local__list_projects, mcp__github-projects-local__get_project_fields, mcp__github-projects-local__get_project_items, mcp__github-projects-local__add_issue_to_project, mcp__github-projects-local__update_project_item_field, mcp__github-projects-local__move_item_to_column
---

# GitHub Tracker

## Configuration

- **Repository:** arttttt/CMIDCABot
- **Project:** CMI DCA Bot

## Stage Flow

```
stage:brief  → Backlog     → /brief created
stage:spec   → Todo        → /spec created
stage:impl   → In Progress → /implement started
stage:review → Review      → /review created
(closed)     → Done        → PR merged
```

## When to Use

- Creating GitHub Issues from artifacts
- Updating issue labels (stage transitions)
- Adding issues to Project board
- Moving issues between columns
- Querying project status

## Quick Reference

### Link Format

Tracker item link in artifact files:
```markdown
<!-- GitHub Issue: #123 -->
```

### Auto-close Syntax

To automatically close tracker item when PR is merged:
```markdown
Closes #<number>
```

### Status Mapping

| Abstract Status | GitHub Label | Project Column |
|-----------------|--------------|----------------|
| backlog | `stage:brief` | Backlog |
| todo | `stage:spec` | Todo |
| implementation | `stage:impl` | In Progress |
| review | `stage:review` | Review |
| done | (Issue closed) | Done |

### Create Issue
Use `create_issue` with repository from Configuration.

### Update Labels
Use `update_issue` to change stage labels.

### Update Status

To update tracker item status:
1. Update label: remove old `stage:*`, add new `stage:*`
2. Move to corresponding Project column

See Status Mapping table for label/column correspondence.

### Add to Project
1. `list_projects` to find project ID
2. `get_project_fields` to get Status field ID
3. `add_issue_to_project` to add issue
4. `update_project_item_field` to set column

### Move Column
Use `move_item_to_column` with project and column name.

## Detailed References

- See `references/issues.md` for issue operations
- See `references/projects.md` for project board operations
