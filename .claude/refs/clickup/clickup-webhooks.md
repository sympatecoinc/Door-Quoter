# ClickUp Webhooks - Detailed Reference

## Overview

Webhooks allow you to receive real-time notifications when events occur in ClickUp. When an event your webhook is subscribed to occurs, ClickUp sends a POST request with event details to the URL you provided during webhook creation.

## Webhook Endpoints

### Create Webhook

**Endpoint:** `POST /team/{team_id}/webhook`

Create a new webhook to receive event notifications.

**Request Body:**
```json
{
  "endpoint": "https://your-endpoint.com/webhook",
  "events": ["taskCreated", "taskUpdated", "taskDeleted"],
  "space_id": "space_id",
  "folder_id": "folder_id",
  "list_id": "list_id",
  "task_id": "task_id"
}
```

**Key Parameters:**
- `endpoint` (required): Your webhook URL (defaults to https if no protocol specified)
- `events` (required): Array of event types to subscribe to
- Location filters (optional): `space_id`, `folder_id`, `list_id`, or `task_id`

**Important Notes:**
- Only one location per hierarchy level can be specified per webhook
- The most specific location applies (combining Space, Folder, List, or Task subscribes to events for the lowest level)
- Non-SSL protocols may not be supported in the future (use https)

### Get Webhooks

**Endpoint:** `GET /team/{team_id}/webhook`

Retrieve all webhooks configured for a Workspace.

**Response:**
```json
{
  "webhooks": [
    {
      "id": "webhook_id",
      "userid": 123,
      "team_id": 456,
      "endpoint": "https://your-endpoint.com/webhook",
      "client_id": "client_id",
      "events": ["taskCreated", "taskUpdated"],
      "task_id": null,
      "list_id": "list_id",
      "folder_id": null,
      "space_id": null,
      "health": {
        "status": "active",
        "fail_count": 0
      }
    }
  ]
}
```

### Update Webhook

**Endpoint:** `PUT /webhook/{webhook_id}`

Update an existing webhook's configuration.

**Request Body:**
```json
{
  "endpoint": "https://new-endpoint.com/webhook",
  "events": ["taskCreated", "taskStatusUpdated"],
  "status": "active"
}
```

### Delete Webhook

**Endpoint:** `DELETE /webhook/{webhook_id}`

Remove a webhook permanently.

---

## Available Events

### Task Events

| Event | Description |
|-------|-------------|
| `taskCreated` | New task created |
| `taskUpdated` | Task updated (any field) |
| `taskDeleted` | Task deleted |
| `taskPriorityUpdated` | Task priority changed |
| `taskStatusUpdated` | Task status changed |
| `taskAssigneeUpdated` | Task assignees changed |
| `taskDueDateUpdated` | Task due date changed |
| `taskTagUpdated` | Task tags changed |
| `taskMoved` | Task moved to different List |
| `taskCommentPosted` | New comment added to task |
| `taskCommentUpdated` | Task comment edited |
| `taskTimeEstimateUpdated` | Task time estimate changed |
| `taskTimeTrackedUpdated` | Time tracked on task |

### List Events

| Event | Description |
|-------|-------------|
| `listCreated` | New List created |
| `listUpdated` | List updated |
| `listDeleted` | List deleted |

### Folder Events

| Event | Description |
|-------|-------------|
| `folderCreated` | New Folder created |
| `folderUpdated` | Folder updated |
| `folderDeleted` | Folder deleted |

### Space Events

| Event | Description |
|-------|-------------|
| `spaceCreated` | New Space created |
| `spaceUpdated` | Space updated |
| `spaceDeleted` | Space deleted |

### Goal Events

| Event | Description |
|-------|-------------|
| `goalCreated` | New Goal created |
| `goalUpdated` | Goal updated |
| `goalDeleted` | Goal deleted |
| `keyResultCreated` | New Key Result created |
| `keyResultUpdated` | Key Result updated |
| `keyResultDeleted` | Key Result deleted |

---

## Webhook Payload Structure

When an event occurs, ClickUp sends a POST request to your webhook URL with the following structure:

### Basic Payload Format

```json
{
  "webhook_id": "webhook_uuid",
  "event": "taskCreated",
  "task_id": "task_id",
  "history_items": [
    {
      "id": "history_id",
      "type": 1,
      "date": "1567780450202",
      "field": "status",
      "parent_id": "parent_task_id",
      "data": {
        "status_type": "open"
      },
      "source": null,
      "user": {
        "id": 183,
        "username": "John Doe",
        "email": "john@example.com",
        "color": "#7b68ee",
        "initials": "JD",
        "profilePicture": null
      },
      "before": {
        "status": "to do",
        "color": "#d3d3d3",
        "orderindex": 0,
        "type": "open"
      },
      "after": {
        "status": "in progress",
        "color": "#4194f6",
        "orderindex": 1,
        "type": "open"
      }
    }
  ]
}
```

### Payload Components

**Top Level:**
- `webhook_id`: UUID of the webhook that triggered
- `event`: Event type that occurred
- `task_id`, `list_id`, `folder_id`, or `space_id`: ID of the affected resource

**history_items Array:**
Contains detailed information about what changed:

- `id`: Unique identifier for this history item
- `type`: Type of change (integer code)
- `date`: Unix timestamp in milliseconds
- `field`: Which field was changed
- `parent_id`: Parent task ID (for subtasks)
- `data`: Additional data about the change
- `source`: Source of the change (null for user actions)
- `user`: User who made the change (object with id, username, email, etc.)
- `before`: State before the change (object)
- `after`: State after the change (object)

### Request Details

**HTTP Method:** POST

**Content-Type:** application/json

**Headers:**
- `Content-Type: application/json`
- `X-Signature`: HMAC signature for webhook verification (if configured)

---

## Automation Webhooks

ClickUp Automations can trigger webhooks using the "Call webhook" action.

### Call Webhook (Current)

**Endpoint configured in Automation UI**

**Payload Example:**
```json
{
  "event": "automation_triggered",
  "automation_id": "automation_uuid",
  "task_id": "task_id",
  "list_id": "list_id",
  "user": {
    "id": 183,
    "username": "John Doe",
    "email": "john@example.com"
  },
  "task": {
    "id": "task_id",
    "name": "Task Name",
    "status": {
      "status": "in progress",
      "color": "#4194f6",
      "type": "open"
    },
    "custom_fields": []
  }
}
```

### Call Webhook (Legacy)

**Endpoint configured in Automation UI**

**Payload Example:**
```json
{
  "taskId": "task_id",
  "webhookId": "automation_webhook_uuid",
  "event": "taskUpdated",
  "historyItems": [
    {
      "field": "status",
      "before": "to do",
      "after": "in progress"
    }
  ]
}
```

**Note:** Legacy format is maintained for backwards compatibility but new implementations should use the current format.

---

## Webhook Security

### Verifying Webhook Signatures

To verify that webhook requests are genuinely from ClickUp:

1. ClickUp can include an `X-Signature` header with webhook requests
2. Generate HMAC signature using your webhook secret
3. Compare generated signature with received signature

**Example Verification (Node.js):**
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const calculatedSignature = hmac.digest('hex');
  
  return signature === calculatedSignature;
}
```

---

## Webhook Health & Reliability

### Health Status

Webhooks include a `health` object in responses:

```json
{
  "health": {
    "status": "active",
    "fail_count": 0
  }
}
```

**Status Values:**
- `active`: Webhook is functioning normally
- `failing`: Webhook has failed multiple times
- `disabled`: Webhook has been automatically disabled due to repeated failures

### Failure Handling

**ClickUp's Retry Policy:**
- Webhooks are retried up to 3 times with exponential backoff
- After multiple consecutive failures, webhooks may be automatically disabled
- Failed webhooks can be re-enabled through the API or UI

**Best Practices:**
- Respond with HTTP 200-299 status codes for successful processing
- Process webhooks asynchronously to avoid timeouts
- Implement idempotency to handle duplicate deliveries
- Monitor webhook health status regularly

---

## Webhook Filtering by Location

### Hierarchy Levels

You can filter webhooks to specific parts of your ClickUp hierarchy:

**Most General (receives all events):**
```json
{
  "endpoint": "https://webhook.example.com",
  "events": ["taskCreated"],
  // No location filters - receives events from entire Workspace
}
```

**Space Level:**
```json
{
  "endpoint": "https://webhook.example.com",
  "events": ["taskCreated"],
  "space_id": "space_123"
  // Receives events only from this Space
}
```

**Folder Level:**
```json
{
  "endpoint": "https://webhook.example.com",
  "events": ["taskCreated"],
  "folder_id": "folder_456"
  // Receives events only from this Folder
}
```

**List Level (Most Specific):**
```json
{
  "endpoint": "https://webhook.example.com",
  "events": ["taskCreated"],
  "list_id": "list_789"
  // Receives events only from this List
}
```

**Task Level (Ultra Specific):**
```json
{
  "endpoint": "https://webhook.example.com",
  "events": ["taskCommentPosted", "taskUpdated"],
  "task_id": "task_abc"
  // Receives events only for this specific task
}
```

### Multiple Location Filtering Rule

**Important:** When multiple location parameters are provided, the most specific (lowest level in hierarchy) takes precedence:

```json
{
  "space_id": "space_123",
  "folder_id": "folder_456",
  "list_id": "list_789"
}
// This webhook will only receive events from list_789
// space_id and folder_id are ignored
```

---

## Common Webhook Patterns

### 1. Task Management Integration

Monitor task changes and sync with external systems:

```json
{
  "endpoint": "https://api.yourapp.com/clickup/tasks",
  "events": [
    "taskCreated",
    "taskUpdated",
    "taskStatusUpdated",
    "taskDeleted"
  ],
  "list_id": "project_list_id"
}
```

### 2. Time Tracking Integration

Track time entries across your Workspace:

```json
{
  "endpoint": "https://api.yourapp.com/clickup/time",
  "events": [
    "taskTimeTrackedUpdated"
  ]
  // No location filter - all time tracking events
}
```

### 3. Comment Notifications

Get notified of all comments in a Space:

```json
{
  "endpoint": "https://api.yourapp.com/clickup/comments",
  "events": [
    "taskCommentPosted",
    "taskCommentUpdated"
  ],
  "space_id": "space_id"
}
```

### 4. Status Change Workflow

Trigger external workflows on status changes:

```json
{
  "endpoint": "https://api.yourapp.com/clickup/workflow",
  "events": [
    "taskStatusUpdated"
  ],
  "list_id": "workflow_list_id"
}
```

---

## Testing Webhooks

### Local Development

Use tools like ngrok to expose local development servers:

```bash
ngrok http 3000
```

Then use the ngrok URL as your webhook endpoint:
```
https://abc123.ngrok.io/webhook
```

### Webhook Testing Services

- **RequestBin**: https://requestbin.com
- **Webhook.site**: https://webhook.site
- **Beeceptor**: https://beeceptor.com

These services provide temporary URLs that display incoming webhook payloads.

---

## Error Handling

### Common HTTP Status Codes

Your webhook endpoint should return appropriate status codes:

| Status Code | Meaning | ClickUp Action |
|-------------|---------|----------------|
| 200-299 | Success | Webhook considered delivered |
| 400-499 | Client Error | No retry, may disable webhook |
| 500-599 | Server Error | Retry with exponential backoff |
| Timeout | No response | Retry with exponential backoff |

### Error Response Format

If your webhook encounters an error, return a descriptive response:

```json
{
  "error": "Invalid payload format",
  "message": "Missing required field: task_id",
  "code": "INVALID_PAYLOAD"
}
```

---

## Rate Limits

Webhook deliveries are subject to ClickUp's rate limits:

- Webhooks are delivered as quickly as possible
- If your endpoint is slow to respond, delivery may be delayed
- Consistently slow endpoints may be disabled

**Recommendations:**
- Respond to webhooks within 5 seconds
- Process webhook data asynchronously
- Use a queue system for time-consuming operations

---

## Best Practices

1. **Idempotency**: Design your webhook handler to safely process duplicate events
2. **Async Processing**: Acknowledge webhooks quickly, process data asynchronously
3. **Error Logging**: Log all webhook failures for debugging
4. **Monitoring**: Set up alerts for webhook failures
5. **Security**: Verify webhook signatures to prevent spoofing
6. **Filtering**: Use location filters to reduce unnecessary webhook traffic
7. **Testing**: Test webhooks thoroughly in development before production
8. **Documentation**: Document your webhook handling logic for maintenance

---

## Troubleshooting

### Webhook Not Receiving Events

1. Verify webhook is active: Check health status via GET webhooks endpoint
2. Confirm event types: Ensure events you're testing are in the subscribed events list
3. Check location filters: Verify the event is occurring in the filtered location
4. Test endpoint accessibility: Ensure your webhook URL is publicly accessible
5. Review logs: Check ClickUp's webhook delivery attempts

### Duplicate Events

- Implement idempotency using event IDs or history item IDs
- Store processed event IDs to detect duplicates
- Use database constraints to prevent duplicate processing

### Missing Events

- Check rate limits on your API token
- Verify webhook health status
- Ensure events are occurring in the correct location
- Review ClickUp status page for service issues

---

## Additional Resources

- **Webhook Documentation**: https://developer.clickup.com/docs/webhooks
- **Create Webhook Reference**: https://developer.clickup.com/reference/createwebhook
- **Common Errors**: https://developer.clickup.com/docs/common_errors

