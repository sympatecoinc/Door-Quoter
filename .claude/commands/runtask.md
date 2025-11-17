# Run Task - ClickUp Task Implementation Workflow

IMPORTANT: MAKE SURE YOU ARE ON THE DEV BRANCH

Automatically implement a ClickUp task end-to-end with testing and updates.

## Instructions

### Step 1: Get Task ID

First, ask the user for the ClickUp task ID using the AskUserQuestion tool:

```
Use AskUserQuestion to ask: "What's the ClickUp task ID you'd like me to implement?"
```

Wait for the user to provide the task ID.

### Step 2: Fetch Task Details

Once you have the task ID, fetch complete task information including subtasks:

```bash
node scripts/clickup-helper.js task <TASK_ID>
node scripts/clickup-helper.js get-subtasks <TASK_ID>
```

**Extract from the task:**

- Task ID
- Task name
- Current description
- Status
- Priority
- Due date
- All subtasks (if any)

**IMPORTANT - Subtask Management:**
If subtasks exist, you MUST:

1. **Record each subtask ID** from the get-subtasks output (they appear at the end of each line)
2. **Store them in a list** to reference during implementation
3. Example subtask output format: `1. 🟡 📋 Subtask Name... | status | assignee | 86b7c21gy`
   - The ID is the last item: `86b7c21gy`

### Step 3: Analyze Scope & Codebase

Thoroughly analyze what needs to be done:

**Understanding the Requirements:**

- Read the task description carefully
- Identify all acceptance criteria
- Note any subtasks and their requirements
- Understand the full scope of changes needed

**Codebase Analysis:**
Use the Task tool with subagent_type=Explore to understand:

- Which files need to be modified
- Current implementation patterns
- Related components/APIs/database schemas
- Data flow (frontend → API → database)
- Testing requirements

### Step 4: Ask Clarifying Questions

Before proceeding, use the AskUserQuestion tool to clarify:

- Implementation approach (if multiple valid options)
- Technical choices (libraries, patterns, etc.)
- Scope decisions (what's in/out of scope)
- Any ambiguities in requirements
- Priority if there are multiple subtasks

**IMPORTANT:** Only proceed after getting answers to your questions.

### Step 5: Plan Implementation

Create a detailed implementation plan using TodoWrite:

- Break down into specific, actionable tasks
- Order tasks logically (database → backend → frontend → tests)
- Include all files that need modification
- Plan for testing steps

Present the plan to the user and get confirmation before proceeding.

### Step 6: Execute Implementation

Follow the workflow from CLAUDE.md:

**6.1 Update Status & Start Time Tracking**

Set the current ClickUp task status to "DEVELOPMENT" and record the start time:

```bash
# Update status to development
node scripts/clickup-helper.js status <TASK_ID> development
```

**IMPORTANT - Record Start Time:**
Note the current time when you begin implementation. You'll use this to calculate total time spent.

Example: "Starting implementation at [TIME]"

**For each task in your plan:**

1. Mark as in_progress in TodoWrite
2. Announce: "Starting: [TASK_DESCRIPTION]"
3. Make the minimal required change using Edit/Write tools
4. Mark complete in TodoWrite
5. Report: "Completed: [TASK_DESCRIPTION] - [SUMMARY]"
6. **If this task corresponds to a ClickUp subtask**, attempt to mark it complete:
   ```bash
   node scripts/clickup-helper.js complete-subtask <SUBTASK_ID>
   ```
   - Use the subtask ID you recorded in Step 2
   - **If the command fails with "Status does not exist" error:** This is expected for subtasks with different status configurations. Simply note the subtask as completed in your tracking and continue. You'll document it in Step 8.
   - **If other errors occur:** Note the error and continue (you can retry in Step 9)
   - When successful, this provides real-time progress updates in ClickUp

**Important Notes:**

- Follow all constraints from CLAUDE.md
- Use Read/Edit/Write tools for file operations
- Never use bash commands for file manipulation
- Stop and request permission if unexpected changes are needed

### Step 7: Test Implementation

After implementation is complete:

**7.1 Launch Dedicated Development Server**

**IMPORTANT:** Start a NEW dedicated dev server specifically for testing. This ensures:
- You have access to real-time server logs for debugging
- The server is running on a unique port for this test session
- Server-side errors and API calls are visible in the terminal output
- You can monitor backend behavior during testing

```bash
npm run dev
```

**Key points:**
- Do NOT reuse an existing dev server instance
- Keep the terminal window visible to monitor server logs
- Note the port number that the dev server starts on (usually 3000)
- Watch for any server errors during testing

**7.2 Automated Testing with Playwright**

Use the Playwright MCP tools to test the implementation:

1. **Navigate to Application:**

   ```
   URL: http://localhost:[PORT]
   Where [PORT] is the dev server port (e.g., 3000)
   ```

2. **Login:**

   - Email: kyle.goevert@sympatecoinc.com
   - Password: Caramia458

3. **Test the Feature:**

   - Navigate to the relevant section
   - Execute the user workflow for the feature
   - Verify all acceptance criteria are met
   - Check for console errors
   - Verify data persistence

4. **Take Screenshots:**
   - Take screenshots of key functionality
   - Document any issues found

**Testing Checklist:**

- [ ] Feature works as expected
- [ ] No console errors
- [ ] Data persists correctly
- [ ] UI updates properly
- [ ] Validation works
- [ ] Edge cases handled

### Step 8: Update ClickUp Task

After successful testing, update the ClickUp task:

**8.1 Prepare Summary**

Create a concise summary in this format:

```markdown
---

## Implementation Summary - [DATE]

### Changes Made

- **[File 1]**: [Brief description of changes]
- **[File 2]**: [Brief description of changes]
- **[File 3]**: [Brief description of changes]

### Features Implemented

✅ [Feature/requirement 1]
✅ [Feature/requirement 2]
✅ [Feature/requirement 3]

### Testing Completed

✅ Manual testing via Playwright
✅ All acceptance criteria verified
✅ No console errors
✅ Data persistence confirmed

### Technical Details

- Approach: [Brief explanation of implementation approach]
- Files modified: [Number] files
- Lines changed: ~[Approximate number]

[Any additional notes or considerations]
```

**8.2 Update Task Description**

```bash
node scripts/clickup-helper.js update <TASK_ID> --append-description "[SUMMARY_FROM_ABOVE]"
```

This will append the summary to the existing description without overwriting.

### Step 9: Update Task Status & Track Time

**9.1 Calculate Time Spent**

Calculate the elapsed time from when you started implementation (Step 6) to now.

Example calculation:

- Start time: 2:00 PM
- End time: 3:30 PM
- Duration: 1.5 hours

**9.2 Track Time in ClickUp**

Record the time spent on this task:

```bash
# Track time spent on implementation and testing
node scripts/clickup-helper.js track-time <TASK_ID> <HOURS> "Task implementation and testing via /runtask"
```

Replace `<HOURS>` with the calculated duration as a decimal (e.g., 1.5 for 1 hour 30 minutes, 0.5 for 30 minutes).

**Important Notes:**

- Be accurate with time tracking - include analysis, implementation, and testing
- Round to nearest 0.25 hours (15 min increments) for cleaner tracking
- Examples: 0.25, 0.5, 0.75, 1, 1.5, 2, etc.

**9.3 Update Task Status**

Mark the task as "testing" and ensure all subtasks are complete:

```bash
# Update main task status to testing
node scripts/clickup-helper.js status <TASK_ID> testing

# Verify all subtasks are marked complete
# (If any subtask marking failed in Step 6, retry them here)
node scripts/clickup-helper.js complete-subtask <SUBTASK_ID_1>
node scripts/clickup-helper.js complete-subtask <SUBTASK_ID_2>
# ... for any remaining subtasks that weren't marked complete in Step 6
```

**Subtask ID Reference:**

- Use the subtask IDs you recorded in Step 2 from the `get-subtasks` output
- Each subtask ID is shown at the end of each line in that output
- If you already marked subtasks complete during Step 6, you can verify status:
  ```bash
  node scripts/clickup-helper.js get-subtasks <TASK_ID>
  ```

### Step 10: Final Report

Provide a summary to the user:

```markdown
## ✅ Task Implementation Complete

**ClickUp Task:** [TASK_ID] - [TASK_NAME]

### Summary

- ✅ Implementation completed
- ✅ Testing passed via Playwright
- ✅ Time tracked: [X] hours
- ✅ ClickUp task updated with summary
- ✅ Task status set to "testing"

### Files Modified

- [List of files]

### Subtasks Status

[If any subtasks couldn't be marked complete via CLI due to status configuration:]
⚠️ The following subtasks need to be marked complete manually in ClickUp:

- [Subtask 1 name] (ID: [SUBTASK_ID])
- [Subtask 2 name] (ID: [SUBTASK_ID])

Note: These subtasks are functionally complete; only the ClickUp status sync failed due to status configuration differences.

### Next Steps

- Task is ready for review
- All tests passed
- Documentation updated in ClickUp
  [If subtasks need manual marking:] - Mark the listed subtasks as complete in ClickUp UI

**ClickUp Link:** https://app.clickup.com/t/[TASK_ID]
```

## Error Handling

**If testing fails:**

1. Document the failure
2. Fix the issues
3. Re-test
4. Update ClickUp with the corrected implementation

**If scope is unclear:**

1. Stop immediately
2. Use AskUserQuestion to clarify
3. Get explicit confirmation before proceeding

**If ClickUp update fails:**

1. Document the error
2. Provide the summary to user manually
3. Ask user to update ClickUp or provide alternative approach

**If time tracking fails:**

1. Note the error in your final report
2. Provide the calculated hours to the user
3. User can manually track time in ClickUp UI
4. Continue with the workflow - time tracking failure should not block completion

**If subtask marking fails:**
Common issues and solutions:

1. **"Status does not exist" error (ECODE: ITEM_114):**

   ```
   Error: API Error 400: {"err":"Status does not exist","ECODE":"ITEM_114"}
   ```

   **Root Cause:** The subtask has a different status configuration than the main task list.

   **Solutions:**

   - **Option A (Recommended):** Continue without marking subtasks via CLI. Instead:

     - Note which subtasks need marking
     - Include them in your final summary to the user
     - User can mark them complete manually in ClickUp UI

   - **Option B:** Use the ClickUp UI to check the subtask's available statuses, then modify the status in clickup-helper.js temporarily

   - **Option C:** Skip automated subtask marking entirely and document completed work in the task description update (Step 8)

   **Important:** This error does NOT indicate a problem with your implementation. The work is complete; only the ClickUp status sync is failing.

2. **Invalid subtask ID error:**

   - Verify the subtask ID by running `node scripts/clickup-helper.js get-subtasks <TASK_ID>` again
   - Ensure you're using the ID from the end of the subtask line (e.g., `86b7c21gy`)
   - The ID should be alphanumeric without special characters

3. **API authentication error:**

   - The API key may have expired or be invalid
   - Report the error to the user and continue with implementation
   - Subtasks can be marked manually in ClickUp UI

4. **Network/connection error:**
   - Retry the command once after a few seconds
   - If still failing, note it and continue
   - Retry all failed subtasks in Step 9

**Best Practice:**

- Don't let subtask marking errors block implementation progress
- Note which subtasks failed to mark and include them in your final summary
- Continue with the implementation and testing even if ClickUp updates fail
- The actual work completion is what matters, not the ClickUp status sync

## Important Reminders

- **ALWAYS** follow CLAUDE.md workflow constraints
- **ALWAYS** get user confirmation before implementing
- **ALWAYS** test thoroughly before updating ClickUp
- **NEVER** overwrite existing ClickUp task data (use --append-description)
- **NEVER** mark task as complete without user approval
- **NEVER** skip testing steps
- **For database connection setup:** Reference `MANUAL_DATABASE_MIGRATION_GUIDE.md` for instructions on establishing Cloud SQL proxy connections to staging/production databases

## Development Server URL

The application URL for testing is:

```
http://localhost:[PORT]
```

Where [PORT] is the port number output by `npm run dev` (usually 3000).

## Login Credentials

```
Email: kyle.goevert@sympatecoinc.com
Password: Caramia458
```

These credentials are used for Playwright automated testing.
