# ClickUp API Reference Documentation

## Overview

The ClickUp API is a RESTful API that allows you to integrate ClickUp's project management features into your applications. The API uses standard HTTP methods, returns JSON responses, and enforces request rate limits per token.

**Base URL:** `https://api.clickup.com/api/v2/`
**API Version 3 Base URL:** `https://api.clickup.com/api/v3/`

## Specialized Documentation

This main reference provides an overview of the ClickUp API. For detailed information on specific topics, refer to these specialized guides:

- **[Authentication & OAuth](clickup-authentication.md)** - Personal tokens, OAuth 2.0 flow, token management, security best practices
- **[Webhooks](clickup-webhooks.md)** - Real-time event notifications, webhook setup, payload formats, security, testing
- **[Rate Limits & Error Handling](clickup-rate-limits-errors.md)** - Rate limit tiers, retry strategies, error codes, monitoring, best practices
- **[Guest Management & Permissions](clickup-guests-permissions.md)** - Inviting guests, permission levels, user groups, security considerations

**Note:** The specialized documentation provides comprehensive details, examples, and best practices for each topic area. This main reference focuses on core API endpoints and basic usage.

## Authentication

### Quick Reference

The ClickUp API supports two authentication methods:

1. **Personal API Token** (for personal use)
2. **OAuth 2.0** (for applications used by others)

**Personal API Token Usage:**
```
Authorization: YOUR_API_TOKEN
```

**OAuth Token Usage:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**📚 For detailed information including:**
- Complete OAuth 2.0 flow
- Token management and security
- Multi-workspace authorization
- Error handling and troubleshooting

**See:** [Authentication & OAuth Detailed Guide](clickup-authentication.md)

## Rate Limits

### Quick Reference

Rate limits vary by Workspace Plan:

| Plan | Requests per Minute |
|------|---------------------|
| Free Forever / Unlimited / Business | 100 |
| Business Plus | 1,000 |
| Enterprise | 10,000 |

**Rate Limit Headers:**
- `X-RateLimit-Limit` - Current limit
- `X-RateLimit-Remaining` - Requests remaining
- `X-RateLimit-Reset` - Reset timestamp

**HTTP 429 Response:** Rate limit exceeded

**📚 For detailed information including:**
- Retry strategies and backoff algorithms
- Rate limit monitoring and alerting
- Request queuing patterns
- Circuit breaker implementation
- Complete error code reference

**See:** [Rate Limits & Error Handling Guide](clickup-rate-limits-errors.md)

## API Terminology

### v2 vs v3 Terminology

**API v2:**
- **Teams** = What is now called Workspaces in ClickUp UI
- Teams are the overarching organizational entity containing users, Spaces, Folders, Lists, and tasks

**API v3:**
- **Workspaces** = Consistent terminology matching current ClickUp UI
- Replaces "Team" terminology from v2

**Both Versions:**
- **Groups** = Collections of users within a Workspace/Team for managing roles and permissions

## Core Concepts

### Hierarchy Structure

```
Workspace (Team in v2)
└── Space
    └── Folder (optional)
        └── List
            └── Task
                └── Subtask
```

### Tasks

Tasks are the building blocks for organizing work in ClickUp. Each task can contain:

- **Name and Description**: Basic task information
- **Assignees**: Array of user IDs assigned to the task
- **Priority Levels**:
  - `1` = Urgent
  - `2` = High
  - `3` = Normal
  - `4` = Low
- **Status**: Current state of the task
- **Due Dates**: Start date and due date (Unix timestamp in milliseconds)
- **Time Estimates**: Estimated time in milliseconds
- **Custom Fields**: Flexible metadata for tasks
- **Tags**: Categorization labels
- **Dependencies**: Tasks that block or are blocked by other tasks
- **Linked Tasks**: Related tasks without dependency relationships

### Task Relationships

**Linked Tasks:**
```json
"linked_tasks": [{
  "task_id": "8xdfdjbgd",
  "link_id": "8xdfm9vmz",
  "date_created": "1744930048464",
  "userid": "395492",
  "workspace_id": "333"
}]
```

**Dependencies:**
```json
"dependencies": [{
  "task_id": "8xdfm9vmz",
  "depends_on": "8xdfe67cz",
  "type": 1,
  "date_created": "1744930371817",
  "userid": "395492",
  "workspace_id": "333",
  "chain_id": null
}]
```

### Subtasks

- Nested subtasks include the task ID of their immediate parent in the `parent` property
- Create subtasks by setting the `parent` property when creating a task
- Use `subtasks` query parameter to include subtasks in responses

---

## Task Endpoints

### Get Tasks

**Endpoint:** `GET /list/{list_id}/task`

View tasks in a List. Responses limited to 100 tasks per page.

**Query Parameters:**
- `archived` (boolean): Include archived tasks
- `page` (integer): Page number for pagination
- `order_by` (string): Field to order by
- `reverse` (boolean): Reverse order
- `subtasks` (boolean): Include subtasks
- `statuses[]` (array): Filter by status names
- `include_closed` (boolean): Include closed tasks
- `assignees[]` (array): Filter by assignee user IDs
- `tags[]` (array): Filter by tag names
- `due_date_gt` (integer): Due date greater than (Unix timestamp ms)
- `due_date_lt` (integer): Due date less than (Unix timestamp ms)
- `date_created_gt` (integer): Created date greater than
- `date_created_lt` (integer): Created date less than
- `date_updated_gt` (integer): Updated date greater than
- `date_updated_lt` (integer): Updated date less than
- `custom_fields` (array): Filter by custom field values

**Notes:**
- Only includes tasks where the specified list_id is their home List
- Use `include_timl` parameter to include tasks that exist in multiple lists
- `time_spent` field displays time tracked in milliseconds (only for tasks with time entries)

### Get Task

**Endpoint:** `GET /task/{task_id}`

View information about a specific task.

**Query Parameters:**
- `custom_task_ids` (boolean): Use custom task ID instead of standard UUID
- `team_id` (integer): Required when using custom task IDs
- `include_subtasks` (boolean): Include subtasks in response

**Response includes:**
- Task details
- Attachments (Docs attached to tasks are not returned)
- Custom fields
- Dependencies and linked tasks

### Create Task

**Endpoint:** `POST /list/{list_id}/task`

Create a new task in a List.

**Request Body:**
```json
{
  "name": "Task Name",
  "description": "Task description",
  "markdown_description": "# Markdown description",
  "assignees": [123, 456],
  "tags": ["tag1", "tag2"],
  "status": "Open",
  "priority": 3,
  "due_date": 1508369194377,
  "due_date_time": false,
  "time_estimate": 8640000,
  "start_date": 1567780450202,
  "start_date_time": false,
  "notify_all": true,
  "parent": "parent_task_id",
  "links_to": "linked_task_id",
  "check_required_custom_fields": true,
  "custom_fields": []
}
```

**Key Fields:**
- `name` (required): Task name
- `description` or `markdown_description`: Task description
- `assignees`: Array of user IDs
- `parent`: Parent task ID to create as subtask
- `priority`: 1=Urgent, 2=High, 3=Normal, 4=Low
- `due_date`: Unix timestamp in milliseconds
- `time_estimate`: Time in milliseconds
- `notify_all`: Notify all assignees

### Update Task

**Endpoint:** `PUT /task/{task_id}`

Update an existing task.

**Request Body:** (All fields optional)
```json
{
  "name": "Updated name",
  "description": "Updated description",
  "status": "in progress",
  "priority": 2,
  "due_date": 1508369194377,
  "time_estimate": 8640000,
  "assignees": {
    "add": [123],
    "rem": [456]
  },
  "archived": false
}
```

### Delete Task

**Endpoint:** `DELETE /task/{task_id}`

Delete a task permanently.

### Add Task To List

**Endpoint:** `POST /list/{list_id}/task/{task_id}`

Add a task to an additional List.

**Note:** Requires the "Tasks in Multiple Lists" ClickApp to be enabled.

### Get Filtered Team Tasks

**Endpoint:** `GET /team/{team_id}/task`

Get tasks from across your entire Workspace with filtering.

**Query Parameters:** Similar to Get Tasks, plus workspace-wide filtering options.

---

## Custom Fields

### Overview

Custom Fields allow you to add flexible metadata to tasks. Each Custom Field has a type that determines what kind of data it can store.

### Custom Field Types

| Type | Description | Value Format |
|------|-------------|--------------|
| `url` | Website URL | String (valid URL) |
| `drop_down` | Menu with options | Option ID from type_config |
| `labels` | Flexible list (like Tags) | Array of label IDs |
| `email` | Email address | String (valid email) |
| `phone` | Phone number | String (with country code) |
| `date` | Date and time | Unix timestamp in milliseconds |
| `short_text` | Single line text | String |
| `text` | Paragraph text | String |
| `checkbox` | True/false | Boolean |
| `number` | Numeric value | Number |
| `currency` | Money amount | Object with currency and amount |
| `tasks` | Linked tasks | Array of task IDs |
| `users` | User assignments | Array of user IDs |
| `progress` | Progress bar | Object or integer |

### Custom Field Object Structure

```json
{
  "id": "5dc86497-098d-4bb0-87d6-cf28e43812e7",
  "name": "Text Field",
  "type": "text",
  "type_config": {},
  "date_created": "1577378759142",
  "hide_from_guests": false
}
```

**Key Properties:**
- `id`: Unique identifier for the Custom Field
- `name`: Display name
- `type`: Field type (see table above)
- `type_config`: Configuration object (varies by type)
- `hide_from_guests`: Visibility setting

### Get Accessible Custom Fields

**Endpoint:** `GET /list/{list_id}/field`

Retrieve all Custom Fields available on a List.

### Set Custom Field Value

**Endpoint:** `POST /task/{task_id}/field/{field_id}`

Set or update a Custom Field value on a task.

**Request Body Examples:**

**Text Field:**
```json
{
  "value": "Text content"
}
```

**Number Field:**
```json
{
  "value": 42
}
```

**Date Field:**
```json
{
  "value": 1508369194377,
  "time": true
}
```

**Drop-down Field:**
```json
{
  "value": "option_id_from_type_config"
}
```

**Currency Field:**
```json
{
  "value": {
    "currency": "USD",
    "amount": 10000
  }
}
```

**Labels Field:**
```json
{
  "value": {
    "labels": ["label_id_1", "label_id_2"]
  }
}
```

**Progress Field (Manual):**
```json
{
  "value": {
    "current": 20,
    "start": 10,
    "end": 30
  }
}
```

**Users Field:**
```json
{
  "value": {
    "add": ["user_id_1"],
    "rem": ["user_id_2"]
  }
}
```

### Usage Limits

- **Free Forever Plans**: 60 uses of Custom Fields
- Each `Set Custom Field Value` API call counts as 1 use
- Uses accumulate across a Workspace and do not reset
- When limit reached, you can't edit or create new items with Custom Fields (no data loss)

### Filtering by Custom Fields

Use Custom Fields to filter tasks with:
- `GET /list/{list_id}/task` (Get Tasks)
- `GET /team/{team_id}/task` (Get Filtered Team Tasks)

**Filter Format:**
```json
{
  "custom_fields": [
    {
      "field_id": "field_uuid",
      "operator": "=",
      "value": "filter_value"
    }
  ]
}
```

**Finding field_id:**
1. Create a task and add value to the Custom Field
2. Use Get Tasks endpoint to identify the field_id and acceptable values

---

## Comments

### Get Task Comments

**Endpoint:** `GET /task/{task_id}/comment`

Retrieve comments for a task.

### Create Task Comment

**Endpoint:** `POST /task/{task_id}/comment`

Add a comment to a task.

**Request Body:**
```json
{
  "comment_text": "Comment content",
  "assignee": 183,
  "notify_all": true
}
```

### Update Comment

**Endpoint:** `PUT /comment/{comment_id}`

Modify an existing comment.

### Delete Comment

**Endpoint:** `DELETE /comment/{comment_id}`

Remove a comment permanently.

**Note:** Comment endpoints apply to task, List, and Chat view comments.

---

## Workspaces (Teams)

### Get Workspaces

**Endpoint:** `GET /team`

Retrieve authorized Workspaces (Teams) for the authenticated user.

**Response includes:**
- Workspace details
- Available members and their user IDs

**Note:** Use this endpoint to retrieve user IDs for task assignments.

### Get Workspace

**Endpoint:** `GET /team/{team_id}`

Get details about a specific Workspace.

---

## Spaces

### Get Spaces

**Endpoint:** `GET /team/{team_id}/space`

Retrieve Spaces within a Workspace.

**Query Parameters:**
- `archived` (boolean): Include archived Spaces

### Get Space

**Endpoint:** `GET /space/{space_id}`

Get details about a specific Space.

### Create Space

**Endpoint:** `POST /team/{team_id}/space`

Create a new Space in a Workspace.

**Request Body:**
```json
{
  "name": "Space Name",
  "multiple_assignees": true,
  "features": {
    "due_dates": {
      "enabled": true,
      "start_date": false,
      "remap_due_dates": true,
      "remap_closed_due_date": false
    },
    "time_tracking": {
      "enabled": false
    }
  }
}
```

### Update Space

**Endpoint:** `PUT /space/{space_id}`

Update Space settings.

### Delete Space

**Endpoint:** `DELETE /space/{space_id}`

Delete a Space permanently.

---

## Folders

### Get Folders

**Endpoint:** `GET /space/{space_id}/folder`

Retrieve Folders within a Space.

**Query Parameters:**
- `archived` (boolean): Include archived Folders

### Create Folder

**Endpoint:** `POST /space/{space_id}/folder`

Create a new Folder in a Space.

**Request Body:**
```json
{
  "name": "Folder Name"
}
```

### Update Folder

**Endpoint:** `PUT /folder/{folder_id}`

Update Folder name.

### Delete Folder

**Endpoint:** `DELETE /folder/{folder_id}`

Delete a Folder permanently.

---

## Lists

### Get Lists

**Endpoint:** `GET /folder/{folder_id}/list` or `GET /space/{space_id}/list`

Retrieve Lists within a Folder or Space (for Spaces without Folders).

**Query Parameters:**
- `archived` (boolean): Include archived Lists

### Get List

**Endpoint:** `GET /list/{list_id}`

Get details about a specific List, including:
- List description (often contains project context, requirements, or guidelines)
- Available statuses
- Custom Fields

### Create List

**Endpoint:** `POST /folder/{folder_id}/list` or `POST /space/{space_id}/list`

Create a new List in a Folder or Space.

**Request Body:**
```json
{
  "name": "List Name",
  "content": "List description",
  "due_date": 1567780450202,
  "due_date_time": false,
  "priority": 1,
  "assignee": 183,
  "status": "red"
}
```

### Update List

**Endpoint:** `PUT /list/{list_id}`

Update List properties.

### Delete List

**Endpoint:** `DELETE /list/{list_id}`

Delete a List permanently.

---

## Time Tracking

### Get Time Entries

**Endpoint:** `GET /team/{team_id}/time_entries`

Retrieve time entries for a Workspace.

**Query Parameters:**
- `start_date` (integer): Unix timestamp in milliseconds
- `end_date` (integer): Unix timestamp in milliseconds
- `assignee` (integer): Filter by user ID
- `include_task_tags` (boolean): Include task tags
- `include_location_names` (boolean): Include Space, Folder, List names
- `space_id` (integer): Filter by Space
- `folder_id` (integer): Filter by Folder
- `list_id` (integer): Filter by List
- `task_id` (string): Filter by task

### Get Task Time Entries

**Endpoint:** `GET /task/{task_id}/time`

Get time entries for a specific task.

### Create Time Entry

**Endpoint:** `POST /team/{team_id}/time_entries`

Track time on a task.

**Request Body:**
```json
{
  "tid": "task_id",
  "start": 1595282680000,
  "duration": 28800000,
  "description": "Time entry description",
  "billable": false,
  "assignee": 183
}
```

**Note:** 
- `duration` is in milliseconds (8640000ms = 1 hour)
- Use `start` without `duration` to create a running timer
- Set `duration` to 0 and include `start` for running timer

### Start Timer

**Endpoint:** `POST /team/{team_id}/time_entries/start`

Start a timer for the authenticated user.

### Stop Timer

**Endpoint:** `PUT /team/{team_id}/time_entries/{timer_id}/stop`

Stop a running timer.

### Delete Time Entry

**Endpoint:** `DELETE /team/{team_id}/time_entries/{timer_id}`

Remove a time entry permanently.

---

## Task Relationships

### Add Dependency

**Endpoint:** `POST /task/{task_id}/dependency`

Create a dependency between tasks.

**Request Body:**
```json
{
  "depends_on": "dependent_task_id",
  "dependency_of": "blocking_task_id"
}
```

**Dependency Types:**
- `depends_on`: This task depends on another task (waits for completion)
- `dependency_of`: This task blocks another task (must complete first)

### Delete Dependency

**Endpoint:** `DELETE /task/{task_id}/dependency`

Remove a dependency relationship.

### Add Task Link

**Endpoint:** `POST /task/{task_id}/link/{links_to_task_id}`

Link tasks together without dependency.

### Delete Task Link

**Endpoint:** `DELETE /task/{task_id}/link/{links_to_task_id}`

Remove a task link.

---

## Views

### Get Views

**Endpoint:** `GET /team/{team_id}/view` or `GET /space/{space_id}/view` or `GET /folder/{folder_id}/view` or `GET /list/{list_id}/view`

Retrieve Views at different levels.

### Get View

**Endpoint:** `GET /view/{view_id}`

Get details about a specific View.

### Get View Tasks

**Endpoint:** `GET /view/{view_id}/task`

Retrieve tasks from a View with filtering.

### View Filtering

Views can be filtered using a sophisticated system with four key components:

1. **Fields**: Task attributes to filter by (status, tag, dueDate, etc.)
2. **Operators**: Comparison type (EQ, ANY, LT, GT, etc.)
3. **Values**: Specific criteria
4. **Groups**: Combine filters with logical operators (AND, OR)

**Filter Structure:**
```json
{
  "op": "AND",
  "search": "keyword search",
  "show_closed": false,
  "filters": {
    "op": "OR",
    "fields": [
      {
        "field": "status",
        "op": "EQ",
        "values": ["open", "in progress"]
      },
      {
        "field": "tag",
        "op": "ANY",
        "values": ["bug", "feature"]
      }
    ]
  }
}
```

**Available Operators:**
- `EQ`: Equals
- `NOT`: Not equals
- `ANY`: Contains any of
- `LT`: Less than
- `GT`: Greater than
- `LTE`: Less than or equal
- `GTE`: Greater than or equal
- `IS SET`: Field has a value
- `IS NOT SET`: Field is null

**Dynamic Date Values:**
- `today`
- `yesterday`
- `tomorrow`
- `thisweek`
- `lastweek`
- `nextweek`
- `overdue`

**Filter by Custom Fields:**
Use format `cf_{{field_id}}` to reference Custom Fields in filters.

**Filter by Assignee:**
```json
{
  "field": "assignee",
  "op": "ANY",
  "values": ["user_id_1", "user_id_2"]
}
```

Or use "Me Mode":
```json
{
  "field": "assignee",
  "op": "EQ",
  "values": {
    "me": true
  }
}
```

---

## Tags

### Get Space Tags

**Endpoint:** `GET /space/{space_id}/tag`

Retrieve tags used in a Space.

### Add Tag to Task

**Endpoint:** `POST /task/{task_id}/tag/{tag_name}`

Add a tag to a task.

### Remove Tag from Task

**Endpoint:** `DELETE /task/{task_id}/tag/{tag_name}`

Remove a tag from a task.

---

## Members, Users, and Guests

### Quick Reference

**User Roles:**
- `1` = Owner
- `2` = Admin
- `3` = Member
- `4` = Guest

**Get Task Members:**
```bash
GET /task/{task_id}/member
```

**Get List Members:**
```bash
GET /list/{list_id}/member
```

**📚 For detailed information including:**
- Inviting and managing guests (Enterprise only)
- Guest permission levels (view, comment, edit)
- Granting access to Folders, Lists, and Tasks
- User Group management
- Shared hierarchy
- Guest billing considerations
- Security best practices

**See:** [Guest Management & Permissions Guide](clickup-guests-permissions.md)

---

## Webhooks

### Quick Reference

ClickUp supports webhooks for real-time event notifications.

**Create Webhook:**
```bash
POST /team/{team_id}/webhook
```

```json
{
  "endpoint": "https://your-endpoint.com/webhook",
  "events": ["taskCreated", "taskUpdated"]
}
```

**Common Events:**
- Task: `taskCreated`, `taskUpdated`, `taskDeleted`, `taskStatusUpdated`
- List: `listCreated`, `listUpdated`, `listDeleted`
- Comment: `taskCommentPosted`
- Goals: `goalCreated`, `goalUpdated`

**📚 For detailed information including:**
- Complete list of 30+ webhook events
- Webhook payload structures and examples
- Filtering by hierarchy levels
- Security and signature verification
- Automation webhook integration
- Testing and troubleshooting

**See:** [Webhooks Detailed Guide](clickup-webhooks.md)

---

## Documents (Docs)

### Get Workspace Documents

**Endpoint:** `GET /team/{team_id}/docs` (API v3)

Retrieve documents in a Workspace.

### Get Document

**Endpoint:** `GET /doc/{doc_id}` (API v3)

Get document details and content.

**Query Parameters:**
- `page` (string): Specific page ID or name to read

**Response includes:**
- Document metadata
- Page structure
- Page content

**Document URLs:**
Format: `https://app.clickup.com/{workspace_id}/v/dc/{doc_id}/{page_id}`

---

## Attachments

### Create Task Attachment

**Endpoint:** `POST /task/{task_id}/attachment`

Upload a file attachment to a task.

**Request:** Multipart form data with file

**Response:**
```json
{
  "id": "attachment_id",
  "url": "https://attachment-url.com/file.pdf"
}
```

---

## Goals

### Get Goals

**Endpoint:** `GET /team/{team_id}/goal`

Retrieve Goals for a Workspace.

### Get Goal

**Endpoint:** `GET /goal/{goal_id}`

Get details about a specific Goal.

### Create Goal

**Endpoint:** `POST /team/{team_id}/goal`

Create a new Goal.

### Update Goal

**Endpoint:** `PUT /goal/{goal_id}`

Update Goal properties.

### Delete Goal

**Endpoint:** `DELETE /goal/{goal_id}`

Delete a Goal permanently.

---

## Checklists

### Create Checklist

**Endpoint:** `POST /task/{task_id}/checklist`

Add a checklist to a task.

**Request Body:**
```json
{
  "name": "Checklist Name"
}
```

### Edit Checklist

**Endpoint:** `PUT /checklist/{checklist_id}`

Update checklist name or position.

### Delete Checklist

**Endpoint:** `DELETE /checklist/{checklist_id}`

Remove a checklist from a task.

### Create Checklist Item

**Endpoint:** `POST /checklist/{checklist_id}/checklist_item`

Add an item to a checklist.

**Request Body:**
```json
{
  "name": "Checklist item",
  "assignee": 183
}
```

### Edit Checklist Item

**Endpoint:** `PUT /checklist/{checklist_id}/checklist_item/{checklist_item_id}`

Update checklist item.

### Delete Checklist Item

**Endpoint:** `DELETE /checklist/{checklist_id}/checklist_item/{checklist_item_id}`

Remove a checklist item.

---

## Important Notes

### Order Index

- The `order_index` field represents the order of statuses, Lists, Folders, and Spaces as displayed in ClickUp
- Tasks and subtasks no longer use `order_index` in ClickUp, though the field is still returned via API

### Task Limitations

- API cannot move tasks between Lists after creation (must be done manually in ClickUp UI)
- Responses are typically limited to 100 items per page
- Use pagination for larger result sets

### Timestamps

- All timestamps are Unix timestamps in milliseconds
- Date Custom Fields without time display default to 4:00 AM in the authorized user's timezone

### Custom Task IDs

Some endpoints support custom task IDs:
- Set `custom_task_ids=true` parameter
- Include `team_id` parameter when using custom IDs

---

## Common Response Codes

### Quick Reference

**Success:**
- `200 OK`: Successful request
- `201 Created`: Resource created
- `204 No Content`: Successful, no response body

**Client Errors:**
- `400 Bad Request`: Invalid request format
- `401 Unauthorized`: Invalid/missing authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded

**Server Errors:**
- `500 Internal Server Error`: Server error
- `502 Bad Gateway`: Gateway error
- `503 Service Unavailable`: Service down
- `504 Gateway Timeout`: Request timeout

**📚 For detailed information including:**
- Complete error code reference
- OAuth error codes (OAUTH_023, etc.)
- Storage and resource errors
- Retry strategies
- Error handling patterns
- Logging and monitoring

**See:** [Rate Limits & Error Handling Guide](clickup-rate-limits-errors.md)

---

## Testing the API

### Try It Feature

Every API endpoint in the documentation can be tested directly from your browser:
1. Navigate to any endpoint page on https://developer.clickup.com/reference/
2. Click "Try It" in the top-right corner
3. Expand the "Security" section and enter your API key
4. Expand "Body" and "Parameters" sections to configure your request
5. Send the request and view the response

### Mock Server

Use the mock server to test with generic data without affecting your actual ClickUp data.

### Postman Collection

All ClickUp API endpoints are available in a public Postman collection:
- Fork the collection to your Postman workspace
- Import and test endpoints easily
- Available at: https://www.postman.com/clickup-api

---

## Best Practices

1. **Read List Descriptions**: List descriptions often contain valuable project context, requirements, or guidelines
2. **Check Required Custom Fields**: Use `check_required_custom_fields=true` when creating tasks
3. **Use Pagination**: Implement proper pagination for large result sets
4. **Handle Rate Limits**: Monitor rate limit headers and implement backoff strategies
5. **Cache User IDs**: Retrieve and cache user IDs from Get Workspaces endpoint
6. **Validate Custom Field Types**: Ensure values match the expected format for each Custom Field type
7. **Include Time Zone Info**: Be aware of timezone handling for date fields
8. **Test with Mock Server**: Use mock server for development to avoid affecting production data

---

## Additional Resources

- **Developer Documentation**: https://developer.clickup.com/docs/
- **API Reference**: https://developer.clickup.com/reference/
- **Postman Collection**: https://www.postman.com/clickup-api
- **Support**: https://support.clickup.com

---

## Changelog Notes

- API v3 endpoints are gradually being rolled out
- v3 uses "Workspace" terminology consistently (replacing "Team" from v2)
- Check individual endpoint documentation for v2 vs v3 availability
- Most current endpoints use v2, with select v3 endpoints for newer features

---

*Last Updated: Based on ClickUp API documentation as of November 2024*
