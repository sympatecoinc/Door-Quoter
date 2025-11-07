# ClickUp Guest Management & Permissions

## Overview

Guests in ClickUp allow you to share specific parts of your Workspace with external collaborators without giving them full member access. The API provides endpoints to invite, manage, and control guest permissions.

**Important:** Most guest management endpoints are only available to Workspaces on the **Enterprise Plan**.

---

## User Roles

ClickUp has four user role levels, identified by numeric codes in API responses:

| Role Code | Role Name | Description |
|-----------|-----------|-------------|
| 1 | Owner | Full control over Workspace |
| 2 | Admin | Administrative access, can manage most settings |
| 3 | Member | Regular workspace member with full access |
| 4 | Guest | Limited access to specific shared items |

**API Field:** `"role": 4` indicates a guest user

---

## Guest Types

### View-Only Guests

- Can view shared tasks, Lists, and Folders
- Cannot edit or comment
- Limited permissions

### Commenting Guests

- Can view and comment on shared items
- Cannot edit tasks or settings
- Moderate permissions

### Editing Guests

- Can view, comment, and edit shared items
- Cannot access workspace-wide settings
- Full task editing permissions

---

## Inviting Guests

### Invite Guest to Workspace

**Endpoint:** `POST /team/{team_id}/guest`

**Permissions Required:** Workspace Owner or Admin

**Plan Required:** Enterprise

**Request Body:**
```json
{
  "email": "guest@example.com",
  "can_edit_tags": true,
  "can_see_time_spent": false,
  "can_see_time_estimated": true,
  "can_create_views": false,
  "custom_role_id": null
}
```

**Parameters:**
- `email` (required): Guest's email address
- `can_edit_tags` (boolean): Allow guest to edit tags
- `can_see_time_spent` (boolean): Show time tracking data
- `can_see_time_estimated` (boolean): Show time estimates
- `can_create_views` (boolean): Allow creating custom views
- `custom_role_id` (integer): Apply custom role template

**Response:**
```json
{
  "guest": {
    "id": 456,
    "username": "Guest User",
    "email": "guest@example.com",
    "color": "#ff6900",
    "profilePicture": null,
    "initials": "GU",
    "role": 4,
    "custom_role": null,
    "last_active": null,
    "date_joined": "1699123456000",
    "date_invited": "1699123456000"
  }
}
```

**Important Notes:**
- Guests must be granted access to specific items after invitation
- Use subsequent endpoints to share Folders, Lists, or Tasks
- Guest receives email invitation automatically

---

## Granting Guest Access

After inviting a guest, you must explicitly grant access to specific Workspace items.

### Add Guest to Folder

**Endpoint:** `POST /folder/{folder_id}/guest/{guest_id}`

**Request Body:**
```json
{
  "permission_level": "edit"
}
```

**Permission Levels:**
- `view`: Read-only access
- `comment`: Can view and comment
- `edit`: Can view, comment, and edit

### Add Guest to List

**Endpoint:** `POST /list/{list_id}/guest/{guest_id}`

**Request Body:**
```json
{
  "permission_level": "edit",
  "include_shared": true
}
```

**Parameters:**
- `permission_level`: `view`, `comment`, or `edit`
- `include_shared`: Share tasks in shared Lists (optional)

### Add Guest to Task

**Endpoint:** `POST /task/{task_id}/guest/{guest_id}`

**Request Body:**
```json
{
  "permission_level": "comment"
}
```

**Use Cases:**
- Share individual tasks without sharing entire List
- Collaborate on specific deliverables
- Limit guest visibility to relevant work

---

## Managing Guest Permissions

### Edit Guest on Workspace

**Endpoint:** `PUT /team/{team_id}/guest/{guest_id}`

**Request Body:**
```json
{
  "username": "Updated Name",
  "can_edit_tags": false,
  "can_see_time_spent": true,
  "can_see_time_estimated": true,
  "can_create_views": false
}
```

**Editable Fields:**
- `username`: Display name
- `can_edit_tags`: Tag editing permission
- `can_see_time_spent`: Time tracking visibility
- `can_see_time_estimated`: Time estimate visibility
- `can_create_views`: View creation permission

### Remove Guest from Workspace

**Endpoint:** `DELETE /team/{team_id}/guest/{guest_id}`

**Effect:**
- Removes guest from entire Workspace
- Revokes all access to shared items
- Cannot be undone via API (must re-invite)

### Remove Guest from Folder

**Endpoint:** `DELETE /folder/{folder_id}/guest/{guest_id}`

**Effect:**
- Removes access to specific Folder only
- Does not affect other shared items

### Remove Guest from List

**Endpoint:** `DELETE /list/{list_id}/guest/{guest_id}`

### Remove Guest from Task

**Endpoint:** `DELETE /task/{task_id}/guest/{guest_id}`

---

## Getting Guest Information

### Get Workspace Guests

**Endpoint:** `GET /team/{team_id}/guest`

Retrieve all guests in a Workspace.

**Response:**
```json
{
  "guests": [
    {
      "id": 456,
      "username": "Guest User",
      "email": "guest@example.com",
      "role": 4,
      "last_active": "1699123456000",
      "date_joined": "1699123456000",
      "can_edit_tags": true,
      "can_see_time_spent": false
    }
  ]
}
```

### Get Task Members (Including Guests)

**Endpoint:** `GET /task/{task_id}/member`

Returns all users with access to a task, including guests.

**Response:**
```json
{
  "members": [
    {
      "id": 183,
      "username": "John Doe",
      "role": 3
    },
    {
      "id": 456,
      "username": "Guest User",
      "role": 4,
      "permission_level": "comment"
    }
  ]
}
```

### Get List Members (Including Guests)

**Endpoint:** `GET /list/{list_id}/member`

Returns all users with access to a List.

---

## Member Management

### Invite User to Workspace (Member)

**Endpoint:** `POST /team/{team_id}/user`

**Plan Required:** Enterprise

**Request Body:**
```json
{
  "email": "member@example.com",
  "admin": false,
  "custom_role_id": null
}
```

**Parameters:**
- `email` (required): User's email address
- `admin` (boolean): Grant admin permissions
- `custom_role_id` (integer): Apply custom role template

**Difference from Guest:**
- Members get access to entire Workspace
- No need to grant access to individual items
- Higher permissions by default

---

## User Groups

User Groups allow you to manage permissions for multiple users at once.

### Create Group

**Endpoint:** `POST /team/{team_id}/group`

**Request Body:**
```json
{
  "name": "External Contractors",
  "member_ids": [456, 789]
}
```

**Parameters:**
- `name` (required): Group name
- `member_ids` (array): User IDs to add to group

**Important Note:**
Adding a guest with view-only permissions to a User Group automatically converts them to a paid guest. If no paid guest seats are available, a member seat is automatically added (prorated charge applies).

### Update Group

**Endpoint:** `PUT /team/{team_id}/group/{group_id}`

**Request Body:**
```json
{
  "name": "Updated Group Name",
  "add_members": [123],
  "rem_members": [456]
}
```

### Get Groups

**Endpoint:** `GET /team/{team_id}/group`

Retrieve all User Groups in a Workspace.

### Delete Group

**Endpoint:** `DELETE /team/{team_id}/group/{group_id}`

---

## Shared Hierarchy

View items that have been shared with the authenticated user.

### Get Shared Hierarchy

**Endpoint:** `GET /team/{team_id}/shared`

Returns tasks, Lists, and Folders shared with the current user.

**Response:**
```json
{
  "shared": {
    "tasks": [
      {
        "id": "task_id",
        "name": "Shared Task",
        "permission_level": "edit"
      }
    ],
    "lists": [
      {
        "id": "list_id",
        "name": "Shared List",
        "permission_level": "view"
      }
    ],
    "folders": []
  }
}
```

**Use Cases:**
- Display what a guest has access to
- Audit sharing permissions
- Guest dashboard showing accessible items

---

## Permission Levels Explained

### View Permission

**Can:**
- See task names and descriptions
- View comments
- See assignees and status
- View custom fields
- See attachments

**Cannot:**
- Edit anything
- Add comments
- Change status
- Add time entries

### Comment Permission

**Can:**
- Everything in View permission
- Add comments
- Reply to threads
- @ mention users

**Cannot:**
- Edit task details
- Change status
- Add time entries
- Assign tasks

### Edit Permission

**Can:**
- Everything in Comment permission
- Edit task names and descriptions
- Change status and priority
- Add/remove assignees
- Update custom fields
- Add time entries (if permitted)
- Upload attachments

**Cannot:**
- Delete tasks (in most cases)
- Change List settings
- Manage integrations

---

## Guest Limitations

### Free Forever Plan

- Limited number of guest seats
- Basic guest permissions only
- May have feature restrictions

### Paid Plans

- More guest seats available
- Advanced permission controls
- Custom role templates (Enterprise)

### Enterprise Plan Features

- Unlimited guests
- Granular permission controls
- Custom guest roles
- Advanced sharing options
- Audit logs for guest activity

---

## Custom Roles (Enterprise)

Enterprise plans can create custom role templates with specific permissions.

### Applying Custom Roles

**When Inviting Guest:**
```json
{
  "email": "guest@example.com",
  "custom_role_id": 123
}
```

**Custom Role Benefits:**
- Consistent permissions across guests
- Easier to manage at scale
- Predefined permission sets
- Quick role assignment

---

## Guest Billing Considerations

### Paid Guest Conversion

Certain actions automatically convert free guests to paid guests:

1. Adding view-only guest to User Group
2. Granting certain advanced permissions
3. Exceeding free guest seat limit

**Billing Impact:**
- Prorated charge based on billing cycle
- Additional member seat may be added
- Charge appears on next invoice

### Monitoring Guest Usage

Track guest count to manage costs:

```javascript
async function getGuestCount(teamId, token) {
  const response = await fetch(
    `https://api.clickup.com/api/v2/team/${teamId}/guest`,
    { headers: { 'Authorization': token } }
  );
  
  const data = await response.json();
  return data.guests.length;
}
```

---

## Best Practices

### 1. Principle of Least Privilege

Grant minimum necessary permissions:
- Start with view-only access
- Upgrade to comment if needed
- Only grant edit for trusted collaborators

### 2. Regular Access Audits

Periodically review guest access:
```javascript
async function auditGuestAccess(teamId, token) {
  const guests = await getGuests(teamId, token);
  
  for (const guest of guests) {
    console.log(`Guest: ${guest.email}`);
    console.log(`Last Active: ${new Date(parseInt(guest.last_active))}`);
    
    // Check if inactive for 90 days
    const inactiveDays = (Date.now() - parseInt(guest.last_active)) / 86400000;
    if (inactiveDays > 90) {
      console.log('⚠️ Consider removing inactive guest');
    }
  }
}
```

### 3. Use Groups for Efficiency

Manage multiple guests as groups:
- Create groups by project or client
- Assign permissions at group level
- Easier to onboard/offboard

### 4. Document Guest Purposes

Track why each guest has access:
```javascript
// Store in your database
const guestRecord = {
  clickup_id: 456,
  email: 'client@example.com',
  purpose: 'Project XYZ collaboration',
  added_by: 'john@company.com',
  date_added: '2024-01-15',
  review_date: '2024-04-15'
};
```

### 5. Automate Guest Removal

Remove guests when projects complete:
```javascript
async function removeProjectGuests(projectId, teamId, token) {
  // Get guests associated with project
  const guests = await getProjectGuests(projectId);
  
  for (const guest of guests) {
    await fetch(
      `https://api.clickup.com/api/v2/team/${teamId}/guest/${guest.id}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': token }
      }
    );
    
    console.log(`Removed guest: ${guest.email}`);
  }
}
```

---

## Security Considerations

### 1. Email Verification

Verify email addresses before inviting:
```javascript
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function isDomainAllowed(email, allowedDomains) {
  const domain = email.split('@')[1];
  return allowedDomains.includes(domain);
}
```

### 2. Access Logging

Log all guest access grants:
```javascript
async function inviteGuestWithLogging(teamId, email, token) {
  console.log(`[${new Date().toISOString()}] Inviting guest: ${email}`);
  
  try {
    const result = await inviteGuest(teamId, email, token);
    
    console.log(`[${new Date().toISOString()}] Guest invited successfully: ${email}`);
    
    // Store in audit log
    await logToDatabase({
      action: 'GUEST_INVITED',
      guest_email: email,
      invited_by: getCurrentUser(),
      timestamp: Date.now()
    });
    
    return result;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Failed to invite guest: ${email}`, error);
    throw error;
  }
}
```

### 3. Expiring Guest Access

Implement time-limited access:
```javascript
async function createTemporaryGuest(teamId, email, expiryDays, token) {
  // Invite guest
  const guest = await inviteGuest(teamId, email, token);
  
  // Schedule removal
  const expiryDate = Date.now() + (expiryDays * 86400000);
  
  await scheduleTask({
    type: 'REMOVE_GUEST',
    guest_id: guest.id,
    team_id: teamId,
    execute_at: expiryDate
  });
  
  return guest;
}
```

---

## Common Issues & Solutions

### Issue: Guest Can't See Shared Items

**Possible Causes:**
1. Not explicitly granted access to Folder/List/Task
2. Permission level too restrictive
3. Item is in archived List

**Solution:**
```javascript
async function troubleshootGuestAccess(guestId, listId, token) {
  // Check if guest exists
  const guest = await getGuest(teamId, guestId, token);
  if (!guest) {
    console.log('Guest not found in Workspace');
    return;
  }
  
  // Check if List is shared with guest
  const members = await getListMembers(listId, token);
  const hasAccess = members.some(m => m.id === guestId);
  
  if (!hasAccess) {
    console.log('Guest does not have access to this List');
    console.log('Grant access using: POST /list/{list_id}/guest/{guest_id}');
  }
}
```

### Issue: Can't Invite Guest (Enterprise Only)

**Error:** Endpoint not available

**Solution:** Verify Workspace plan:
```javascript
async function checkEnterpriseFeatures(teamId, token) {
  const team = await getTeam(teamId, token);
  
  if (team.plan !== 'Enterprise') {
    console.log('Guest management requires Enterprise plan');
    console.log('Current plan:', team.plan);
    return false;
  }
  
  return true;
}
```

---

## Example Workflows

### Complete Guest Onboarding

```javascript
async function onboardGuest(teamId, email, projectListId, token) {
  try {
    // 1. Invite guest to Workspace
    console.log('Inviting guest...');
    const guest = await fetch(
      `https://api.clickup.com/api/v2/team/${teamId}/guest`,
      {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          can_edit_tags: false,
          can_see_time_spent: false,
          can_create_views: false
        })
      }
    ).then(r => r.json());
    
    // 2. Grant access to project List
    console.log('Granting List access...');
    await fetch(
      `https://api.clickup.com/api/v2/list/${projectListId}/guest/${guest.guest.id}`,
      {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          permission_level: 'comment'
        })
      }
    );
    
    console.log(`✓ Guest onboarded: ${email}`);
    return guest;
  } catch (error) {
    console.error('Guest onboarding failed:', error);
    throw error;
  }
}
```

### Bulk Guest Removal

```javascript
async function removeInactiveGuests(teamId, inactiveDays, token) {
  const guests = await fetch(
    `https://api.clickup.com/api/v2/team/${teamId}/guest`,
    { headers: { 'Authorization': token } }
  ).then(r => r.json());
  
  const cutoffDate = Date.now() - (inactiveDays * 86400000);
  const removedGuests = [];
  
  for (const guest of guests.guests) {
    const lastActive = parseInt(guest.last_active);
    
    if (lastActive < cutoffDate) {
      await fetch(
        `https://api.clickup.com/api/v2/team/${teamId}/guest/${guest.id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': token }
        }
      );
      
      removedGuests.push(guest.email);
      console.log(`Removed inactive guest: ${guest.email}`);
    }
  }
  
  return removedGuests;
}
```

---

## Additional Resources

- **Invite Guest**: https://developer.clickup.com/reference/inviteguesttoworkspace
- **Add Guest to List**: https://developer.clickup.com/reference/addguesttolist
- **Add Guest to Task**: https://developer.clickup.com/reference/addguesttotask
- **User Groups**: https://developer.clickup.com/reference/createusergroup
- **Shared Hierarchy**: https://developer.clickup.com/reference/sharedhierarchy

