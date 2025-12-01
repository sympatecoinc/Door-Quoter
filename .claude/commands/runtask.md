# Run Task - ClickUp Task Implementation Workflow

Automatically implement a ClickUp task end-to-end with testing and updates.

**Argument:** `$ARGUMENTS` (ClickUp Task ID - required)

---

## Pre-Flight Checklist

**BEFORE PROCEEDING, verify:**
- [ ] You are on the **dev** branch (run `git branch --show-current` if unsure)
- [ ] No uncommitted changes that could interfere (`git status`)

If not on dev branch, switch to it before continuing.

---

## Step 1: Initialize Task Context

### 1.1 Validate Task ID

The task ID is: `$ARGUMENTS`

**If $ARGUMENTS is empty or invalid:**
Use AskUserQuestion: "What's the ClickUp task ID you'd like me to implement?"

### 1.2 Fetch Task Details (Run in Parallel)

Execute BOTH commands simultaneously to save time:

```bash
# Command 1: Get task details
node scripts/clickup-helper.js task <TASK_ID>

# Command 2: Get subtasks
node scripts/clickup-helper.js get-subtasks <TASK_ID>
```

### 1.3 Create Task Context Record

**IMMEDIATELY after fetching, create this structured record using TodoWrite:**

```
Task Context:
- Task ID: [ID]
- Task Name: [NAME]
- Start Time: [CURRENT_TIME in HH:MM format]
- Subtask IDs: [LIST_ALL_SUBTASK_IDS]
```

**CRITICAL:** The start time MUST be recorded now. You will need it for time tracking in Step 9.

**Subtask ID Extraction:**
- Subtask IDs appear at the END of each line in get-subtasks output
- Format: `1. 🟡 📋 Subtask Name... | status | assignee | 86b7c21gy`
- The ID is the last alphanumeric string: `86b7c21gy`

---

## Step 2: Analyze Requirements

### 2.1 Understanding the Task

From the task description, extract:
- **Primary Goal:** What is the main deliverable?
- **Acceptance Criteria:** What must be true when complete?
- **Constraints:** Any limitations or requirements mentioned?

### 2.2 Codebase Analysis

Use `Task tool with subagent_type=Explore` to understand:
- Which files need modification
- Current implementation patterns
- Related components/APIs/database schemas
- Data flow (frontend → API → database)

**Output a file list:**
```
Files to analyze:
• path/to/file1.tsx - reason
• path/to/file2.ts - reason
```

---

## Step 3: Clarification Checkpoint

**STOP and ask questions BEFORE planning if ANY of these are unclear:**

Using AskUserQuestion, clarify:
- Implementation approach (if multiple valid options exist)
- Technical choices (libraries, patterns)
- Scope boundaries (what's in vs out)
- Priority order for multiple subtasks
- Any ambiguities in requirements

**Rule:** Do NOT proceed to Step 4 until all questions are answered.

---

## Step 4: Create Implementation Plan

### 4.1 Build TodoWrite Task List

Create a detailed task list with:
- Specific, actionable items
- Logical order (database → backend → frontend → tests)
- Each file that needs modification
- Testing steps

### 4.2 Present Plan for Approval

Show the user:
1. Summary of changes
2. Files to be modified
3. Estimated complexity

**Request:** "Please confirm this plan before I proceed."

**Do NOT proceed until user confirms.**

---

## Step 5: Update ClickUp Status

Set task status to "DEVELOPMENT":

```bash
node scripts/clickup-helper.js status <TASK_ID> development
```

**If this fails:** Note the error, but continue with implementation. Status can be updated manually later.

---

## Step 6: Execute Implementation

### 6.1 Implementation Loop

For EACH task in your plan:

1. **Mark in_progress** in TodoWrite
2. **Announce:** "Starting: [TASK_DESCRIPTION]"
3. **Implement** using Read/Edit/Write tools (NEVER bash for file operations)
4. **Mark complete** in TodoWrite
5. **Report:** "Completed: [TASK_DESCRIPTION] - [ONE_LINE_SUMMARY]"

### 6.2 Subtask Completion (As You Go)

**When completing work that corresponds to a ClickUp subtask:**

```bash
node scripts/clickup-helper.js complete-subtask <SUBTASK_ID>
```

**Expected Errors (Non-Blocking):**
- `"Status does not exist" (ITEM_114)`: Subtask has different status config. Note it and continue.
- `API authentication error`: Note and continue; mark manually later.
- `Network error`: Retry once, then note and continue.

**Tracking:** Keep a list of which subtasks you've attempted to mark complete and their results.

### 6.3 Unexpected Changes

If you need to modify a file NOT in the approved plan:

```
⚠️ PERMISSION REQUIRED
File: [path/to/file.ext]
Reason: [Why this change is needed]
Action needed: Please confirm to proceed
```

**STOP and wait for approval.**

---

## Step 7: Test Implementation

### 7.1 Start Development Server

```bash
npm run dev
```

**IMPORTANT:**
- Note the PORT number from the output (usually 3000, but verify)
- Watch for startup errors
- Keep terminal visible to monitor server logs

### 7.2 Automated Testing with Playwright

**Navigate to:** `http://localhost:[PORT]` (use the actual port from 7.1)

**Login Credentials:**
- Email: `kyle.goevert@sympatecoinc.com`
- Password: `Caramia458`

**Testing Workflow:**
1. Navigate to the relevant section
2. Execute the user workflow for the feature
3. Verify all acceptance criteria
4. Check browser console for errors (use `mcp__playwright__browser_console_messages`)
5. Verify data persistence (reload and check)

### 7.3 Testing Checklist

Complete ALL items:
- [ ] Feature works as expected
- [ ] No console errors
- [ ] Data persists correctly after refresh
- [ ] UI updates properly
- [ ] Validation works (try invalid inputs)
- [ ] Edge cases handled

**If ANY test fails:** Document the failure, fix the issue, and re-test before proceeding.

### 7.4 Take Screenshots

Capture key functionality for documentation.

---

## Step 8: Update ClickUp Task Description

### 8.1 Generate Implementation Summary

Create this EXACT format:

```markdown
---

## Implementation Summary - [YYYY-MM-DD]

### Changes Made

- **[File 1]**: [Brief description]
- **[File 2]**: [Brief description]

### Features Implemented

✅ [Feature/requirement 1]
✅ [Feature/requirement 2]

### Testing Completed

✅ Manual testing via Playwright
✅ All acceptance criteria verified
✅ No console errors
✅ Data persistence confirmed

### Technical Details

- Approach: [Brief explanation]
- Files modified: [N] files
- Lines changed: ~[N]
```

### 8.2 Append to Task

```bash
node scripts/clickup-helper.js update <TASK_ID> --append-description "[SUMMARY_FROM_ABOVE]"
```

---

## Step 9: Time Tracking & Final Status

### 9.1 Calculate Time Spent

**Recall the start time from Step 1.3.**

Calculate elapsed time:
- Start time: [FROM_STEP_1.3]
- Current time: [NOW]
- Duration: [CALCULATE_DIFFERENCE]

**Round to nearest 0.25 hours:**
- 15 min = 0.25h
- 30 min = 0.5h
- 45 min = 0.75h
- 1h 15min = 1.25h

### 9.2 Track Time

```bash
node scripts/clickup-helper.js track-time <TASK_ID> <HOURS> "Task implementation and testing via /runtask"
```

**If this fails:** Note the calculated hours in your final report for manual entry.

### 9.3 Update Status to Testing

```bash
node scripts/clickup-helper.js status <TASK_ID> testing
```

### 9.4 Verify Subtask Completion

Check if any subtasks failed to mark complete earlier:

```bash
node scripts/clickup-helper.js get-subtasks <TASK_ID>
```

For any still incomplete:
```bash
node scripts/clickup-helper.js complete-subtask <SUBTASK_ID>
```

---

## Step 10: Final Report

Generate this report for the user:

```markdown
## ✅ Task Implementation Complete

**ClickUp Task:** [TASK_ID] - [TASK_NAME]
**Duration:** [X] hours (started at [START_TIME])

### Summary

- ✅ Implementation completed
- ✅ Testing passed via Playwright
- ✅ Time tracked: [X] hours
- ✅ ClickUp task updated
- ✅ Status set to "testing"

### Files Modified

- [file1.tsx]
- [file2.ts]

### Subtask Status

[IF ALL COMPLETE:]
✅ All subtasks marked complete

[IF SOME FAILED:]
⚠️ Manual action needed - mark these complete in ClickUp:
- [Subtask name] (ID: [ID])

### Next Steps

- Task ready for review
- All tests passed

**ClickUp Link:** https://app.clickup.com/t/[TASK_ID]
```

---

## Quick Reference: Error Recovery

| Error | Action |
|-------|--------|
| Task ID not found | Verify ID, check for typos |
| Status update fails | Continue; update manually |
| Subtask marking fails (ITEM_114) | Expected; note for manual marking |
| Time tracking fails | Note hours; user can enter manually |
| Test fails | Fix issue, re-test, don't proceed until passing |
| Dev server port conflict | Kill existing process or use different port |
| ClickUp API auth error | Check API key validity; continue with implementation |

---

## Constraints (from CLAUDE.md)

- ✅ Always work on dev branch
- ✅ Use Read/Edit/Write tools for files (never bash)
- ✅ Get user approval before implementing
- ✅ Stop and request permission for unexpected changes
- ❌ Never merge to main without explicit permission
- ❌ Never deploy without explicit "DEPLOY" permission
