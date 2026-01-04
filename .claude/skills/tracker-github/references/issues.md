# GitHub Issues Operations

## Creating Issues

Issues can be created from:
- **BRIEF** — when analyst creates technical brief
- **TASK** — when spec is created directly (analyst step skipped)

### Issue Format

- **Title:** From first `#` heading of artifact
- **Labels:**
  - From BRIEF: `stage:brief`
  - From TASK: `stage:spec`
- **Body format:**
  ```
  <summary>

  ---
  _Artifacts attached as comments below_
  _Source: `<filepath>` (local, not yet in main)_
  ```

## Updating Labels

### Stage Transitions

| From | To | Action |
|------|----|--------|
| `stage:brief` | `stage:spec` | TASK published to existing Issue |
| `stage:spec` | `stage:impl` | Implementation started |
| `stage:impl` | `stage:review` | Review started |

Use `update_issue` with:
- Remove old stage label
- Add new stage label

## Adding Comments

Use `add_issue_comment` to attach artifact content:

```markdown
## Brief | Specification

<full artifact content>

---
_Source: `<filepath>`_
```

## Artifact Linking

Every artifact file should have Issue link as first line:
```markdown
<!-- GitHub Issue: #123 -->
```

Parse this to find related Issue number.

## Language

All Issue content MUST be in English.
Translate Russian content when creating Issues.
