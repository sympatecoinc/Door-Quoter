# ClickUp Integration Command

Access and manage your ClickUp tasks directly from Claude.

## Usage

### View all ERP Development tasks
```
/clickup list
```
Shows all tasks in your ERP Development list with status, assignee, and priority.

### View specific task details
```
/clickup task <task_id>
```
Shows full details of a specific task including description, custom fields, and links.

### Create a new task
```
/clickup create <task_title>
```
Creates a new task in the ERP Development list. You'll be prompted for additional details.

### Update task status
```
/clickup status <task_id> <status>
```
Updates a task's status. Available statuses:
- planning
- in_development
- testing
- ready_for_review
- complete
- blocked

### Search tasks
```
/clickup search <query>
```
Searches tasks by name or description.

## Instructions for Claude

When this command is invoked, use the helper script at `scripts/clickup-helper.js` to interact with the ClickUp API.

**Command Format:**
```bash
node scripts/clickup-helper.js <action> [arguments]
```

**Available Actions:**
- `list` - Get all tasks from ERP Development list
- `task <task_id>` - Get specific task details
- `create <title>` - Create a new task (interactive)
- `status <task_id> <status>` - Update task status
- `search <query>` - Search for tasks

**Example:**
```bash
# List all tasks
node scripts/clickup-helper.js list

# Get task details
node scripts/clickup-helper.js task 86b7c21gt

# Update status
node scripts/clickup-helper.js status 86b7c21gt in_development

# Search tasks
node scripts/clickup-helper.js search "vendor"
```

**Output Formatting:**
Present the results in a clean, readable format:
- Use markdown tables for task lists
- Show status with color indicators: 🟢 (complete), 🟡 (in progress), ⚪ (planning), 🔴 (blocked)
- Include clickable ClickUp URLs for each task
- Highlight priority tasks with ⚠️ for high priority, 🔥 for urgent

**Error Handling:**
If the script fails, check:
1. The helper script exists at `scripts/clickup-helper.js`
2. The API credentials are configured
3. The list ID is correct (901413165777)
4. Network connectivity to ClickUp API

**Integration Notes:**
- This command connects to ClickUp List ID: 901413165777 (ERP Development)
- Team ID: 1232076
- Tasks are automatically assigned to Kyle Goevert
- Custom fields: Feature (dropdown) and Type (dropdown)
