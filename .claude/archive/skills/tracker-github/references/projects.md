# GitHub Projects Operations

## Project Structure

### Columns (Status Field)

| Column | Stage Label | When |
|--------|-------------|------|
| Backlog | `stage:brief` | Brief created |
| Todo | `stage:spec` | Spec created |
| In Progress | `stage:impl` | Implementation started |
| Review | `stage:review` | Code review started |
| Done | (closed) | PR merged |

## Adding Issue to Project

### Step-by-step

1. **Find project:**
   ```
   list_projects(owner: "arttttt")
   ```
   Look for "CMI DCA Bot"

2. **Get field IDs:**
   ```
   get_project_fields(owner: "arttttt", project_number: <N>)
   ```
   Find "Status" field and its option IDs

3. **Add issue:**
   ```
   add_issue_to_project(owner: "arttttt", project_number: <N>, issue_id: <ID>)
   ```

4. **Set status:**
   ```
   update_project_item_field(...)
   ```
   Set to appropriate column based on artifact type

## Moving Between Columns

Use `move_item_to_column`:
- `project_id`: from list_projects
- `item_id`: the project item (not issue) ID
- `column_name`: target column name

## Querying Status

### Get all items
```
get_project_items(owner: "arttttt", project_number: <N>)
```

### Get specific issue status
1. Get issue details with `get_issue`
2. Find in project items by issue number
3. Read Status field value
