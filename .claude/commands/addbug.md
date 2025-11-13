# Add Bug - Quick Bug Report to ClickUp

Report a bug and add it as a subtask to an existing ClickUp task with automatic bug status assignment.

## Overview

This command streamlines the bug reporting process by:
1. Prompting for the parent ClickUp task ID
2. Collecting a bug description
3. Creating a subtask with status "Bug"
4. Prompting the user to run `/debug` for diagnosis

---

## Instructions

### Step 1: Request Task ID

Ask the user for the parent ClickUp task ID:

```
What's the ClickUp task ID where this bug should be added?

You can find task IDs by running: /clickup list
```

Wait for the user to provide the task ID.

### Step 2: Verify Task Exists

Fetch the task to confirm it exists and show context:

```bash
node scripts/clickup-helper.js task <TASK_ID>
```

Display the task name to the user:
```
Adding bug to: [TASK_NAME]
```

If the task doesn't exist, inform the user and exit:
```
❌ Task not found. Please verify the task ID and try again.
```

### Step 3: Request Bug Description

Prompt the user for the bug description:

```
Please describe the bug. Include:
- What's happening (the bug behavior)
- What should happen (expected behavior)
- Steps to reproduce (if applicable)
- Any error messages

Provide your description (can be a few sentences or a full paragraph):
```

Wait for the user to provide the bug description.

### Step 4: Generate Bug Report

Format the bug description into a structured report:

```markdown
## Bug Report

### Description
[User's description]

### Status
🐛 New bug - needs investigation

### Reported
[Current date/time]

### Next Steps
1. Run `/debug` to diagnose the issue
2. Identify root cause
3. Implement fix
4. Verify fix with testing
```

### Step 5: Create Subtask

Create the subtask using the ClickUp helper:

```bash
node scripts/clickup-helper.js subtask <PARENT_TASK_ID> "Bug: [Brief title from description]" "[Formatted bug report]"
```

**Subtask Title Format:**
Extract a brief title from the description (first sentence or key phrase), prefixed with "Bug: "

Examples:
- "Bug: Opening price calculation returns null"
- "Bug: Export CSV missing pricing rules"
- "Bug: Master Parts search not filtering correctly"

**Subtask Description:**
Use the formatted bug report from Step 4.

### Step 6: Update Subtask Status to Bug

After creating the subtask, update its status to "bug":

```bash
node scripts/clickup-helper.js status <SUBTASK_ID> bug
```

**Note:** The subtask ID will be returned from the create command in Step 5.

### Step 7: Confirmation & Next Steps

Display confirmation to the user:

```markdown
✅ Bug reported successfully!

**Subtask Created:**
- **ID:** [SUBTASK_ID]
- **Title:** Bug: [Title]
- **Status:** Bug
- **Parent Task:** [PARENT_TASK_NAME] ([PARENT_TASK_ID])
- **URL:** https://app.clickup.com/t/[SUBTASK_ID]

---

### Next Steps

**Diagnose the bug:**
Run the `/debug` command to:
- Run comprehensive diagnostics
- Analyze the issue with AI-powered thinking
- Create a fix plan
- Implement fixes systematically
- Verify with automated Playwright testing

Use: `/debug`

Or, if you want to manually investigate first, you can:
- Review the code in the affected area
- Check recent changes with `git log`
- Run specific tests related to the bug
```

---

## Important Notes

### Bug Title Extraction
When creating the subtask title, extract the most relevant information from the user's description:

**Good Titles:**
- "Bug: Calculate price returns NaN for custom openings"
- "Bug: Import CSV fails with special characters"
- "Bug: Project deletion doesn't remove associated openings"

**Avoid:**
- Generic titles like "Bug: Fix issue"
- Overly long titles (keep under 60 characters)
- Titles without context

### Handling Edge Cases

**If parent task already has "Bug" status:**
Ask the user if they want to:
1. Still create a subtask (multiple related bugs)
2. Update the existing task description instead

**If bug description is too short:**
If the description is less than 10 words, prompt for more detail:
```
The description seems brief. Could you provide more detail about:
- What specific behavior you're seeing?
- What you expected to happen?
- Any error messages or symptoms?
```

**If bug description is very long:**
If description exceeds 1000 characters, summarize the key points for the title:
- Extract the main issue
- Keep title concise
- Put full details in the description

### Status Mapping

The bug status in ClickUp uses the status ID from the STATUS_MAP in clickup-helper.js:
```javascript
'bug': 'sc901413165777_Zki6v0Ud'
```

This automatically sets the subtask to the "Bug" column/status in the ClickUp list.

---

## Example Usage

### Example 1: Simple Bug Report

**User Input:**
```
Task ID: 86b7c21gt
Description: When I try to export the master parts CSV with pricing rules,
the exported file is empty. It should include all parts with their pricing
rules like it did before.
```

**Result:**
```
✅ Bug reported successfully!

Subtask Created:
- ID: 86b7d52mn
- Title: Bug: Export master parts CSV with pricing rules returns empty file
- Status: Bug
- Parent Task: Master Parts Export Feature (86b7c21gt)
- URL: https://app.clickup.com/t/86b7d52mn

Next Steps: Run `/debug` to diagnose and fix this issue.
```

### Example 2: Detailed Bug Report

**User Input:**
```
Task ID: 86b7e93pq
Description: There's a critical issue with the opening price calculation.
When creating a new opening with:
- Width: 36 inches
- Height: 84 inches
- Color: Bronze
- Glass type: Clear

The calculated price shows as $0.00 instead of the expected ~$450.
This started happening after the recent stock length rules changes.
Console shows: "TypeError: Cannot read property 'basePrice' of undefined"
```

**Result:**
```
✅ Bug reported successfully!

Subtask Created:
- ID: 86b7f84rs
- Title: Bug: Opening price calculation returns $0.00 with TypeError
- Status: Bug
- Parent Task: Opening Pricing System (86b7e93pq)
- URL: https://app.clickup.com/t/86b7f84rs

Next Steps: Run `/debug` to diagnose and fix this issue.
```

---

## Integration with /debug Command

After creating the bug subtask, the user should run `/debug` which will:

1. **Run diagnostics** to identify the issue
2. **Analyze with thinking mode** to understand root cause
3. **Create a fix plan** with prioritized steps
4. **Implement fixes** systematically
5. **Verify with Playwright** automated testing
6. **Document everything** in a comprehensive report

This creates a smooth workflow:
```
/addbug → Report bug to ClickUp
    ↓
/debug → Diagnose, fix, and verify
    ↓
Update ClickUp subtask with fix details
```

---

## Error Handling

### Script Execution Errors
If the clickup-helper.js script fails:
```
❌ Error creating bug subtask: [ERROR_MESSAGE]

Please verify:
1. ClickUp API credentials are configured
2. Parent task ID is correct
3. Network connection is available

Try running manually:
node scripts/clickup-helper.js task <TASK_ID>
```

### Invalid Task ID
If task ID format is wrong:
```
❌ Invalid task ID format: [PROVIDED_ID]

ClickUp task IDs are typically 9 characters (e.g., 86b7c21gt)

Run `/clickup list` to see available tasks.
```

### Permission Issues
If user doesn't have permission to create subtasks:
```
❌ Permission denied: Cannot create subtask

This may happen if:
- You don't have write access to this task
- The task is in a closed status
- The workspace settings restrict subtask creation

Contact your ClickUp admin or try a different task.
```

---

## Output Formatting

### Success Message Template
```markdown
✅ Bug reported successfully!

**Subtask Created:**
- **ID:** [ID]
- **Title:** [Title with "Bug: " prefix]
- **Status:** Bug 🐛
- **Parent Task:** [Parent name] ([Parent ID])
- **URL:** [ClickUp URL]

---

### 🔍 Next Steps

**Recommended:** Run `/debug` for automated diagnosis and fix workflow

**Manual Investigation:**
- Review code in affected area
- Check recent commits: `git log --oneline -10`
- Run related tests

**Update the subtask when:**
- You identify the root cause
- You implement a fix
- You verify the fix works
```

---

## Success Criteria

The `/addbug` command is successful when:
- ✅ User provides valid task ID
- ✅ User provides meaningful bug description
- ✅ Subtask created successfully in ClickUp
- ✅ Subtask status set to "Bug"
- ✅ User is prompted to run `/debug`
- ✅ User receives clear confirmation with subtask URL
- ✅ Bug is trackable in ClickUp workflow

---

*This command streamlines bug reporting by integrating directly with ClickUp and guiding the user to the diagnostic workflow.*
