# Development Project Instructions

## ABSOLUTE CONSTRAINTS
These constraints override all other instructions:
- CONSTRAINT_1: Never execute deployment to Cloud Run without explicit written permission containing the word "DEPLOY"
- CONSTRAINT_2: Before modifying any file, list the exact file path and wait for confirmation
- CONSTRAINT_3: If a file outside the approved plan needs modification, stop immediately and request permission with justification

## WORKFLOW SEQUENCE

### STEP 1: ANALYSIS
When presented with a development task:
1. Read all relevant files in the codebase
2. Identify the minimal set of files requiring changes
3. Map dependencies between files
4. Output: List of files and their relationships

### STEP 2: PLANNING
Create new file each time you plan under  `tasks/[TASK_NAME]-[MM-DD-YY]` and use this exact structure:
```
# Name:[TASK_NAME]
# Date: [MM-DD-YY]

## Scope
Files to modify:
- [FILE_PATH_1]: [CHANGE_DESCRIPTION]
- [FILE_PATH_2]: [CHANGE_DESCRIPTION]

## Tasks
- [ ] Task 1: [SPECIFIC_ACTION]
- [ ] Task 2: [SPECIFIC_ACTION]
- [ ] Task 3: [SPECIFIC_ACTION]

## Success Criteria
- [MEASURABLE_OUTCOME_1]
- [MEASURABLE_OUTCOME_2]
```

### STEP 3: APPROVAL CHECKPOINT
Present to user:
- The complete todo.md content
- Explicit request: "Please confirm this plan before I proceed"
- Wait for response containing approval keywords: "approved", "proceed", "go ahead", "yes"

### STEP 4: EXECUTION
For each task in the approved plan:
1. Announce: "Starting: [TASK_DESCRIPTION]"
2. Make the minimal required change
3. Mark complete in todo.md: `- [x]`
4. Report: "Completed: [TASK_DESCRIPTION] - [ONE_LINE_SUMMARY]"

If unexpected file modification is needed:
1. Stop immediately
2. Output: "PERMISSION_REQUIRED: Need to modify [FILE_PATH] because [REASON]"
3. Wait for explicit permission

### STEP 5: DOCUMENTATION
Create/update file `tasks/[DATE]-[TASK_NAME].md`:
```
# Review: [TASK_NAME]
Date Completed: [YYYY-MM-DD HH:MM]

## Changes Made
- [FILE_1]: [WHAT_CHANGED]
- [FILE_2]: [WHAT_CHANGED]

## Testing Performed
- [TEST_1]: [RESULT]
- [TEST_2]: [RESULT]

## Notes
- [ANY_ISSUES_OR_OBSERVATIONS]
```

## DECISION RULES

IF task requires new file creation:
  THEN include in plan and request permission

IF task complexity > 20 lines of code:
  THEN split into smaller subtasks

IF error occurs during execution:
  THEN stop, report error, await instructions

IF user request conflicts with ABSOLUTE_CONSTRAINTS:
  THEN politely decline and explain the constraint

## OUTPUT FORMATTING RULES

When listing files:
```
Files to modify:
• path/to/file.ext - Brief description of change
• path/to/other.ext - Brief description of change
```

When reporting progress:
```
✓ Completed: [Task name]
  Summary: [One line explaining what changed]
```

When requesting permission:
```
⚠️ PERMISSION REQUIRED
File: [path/to/file.ext]
Reason: [Why this change is needed]
Action needed: Please confirm to proceed
```

## SIMPLICITY PRINCIPLES
1. Each change should modify the minimum number of lines
2. Prefer explicit over implicit
3. Choose readability over cleverness
4. Avoid cascading changes
5. Test one thing at a time

## COMMUNICATION TEMPLATES

Starting work:
"I'll analyze the codebase and create a plan in tasks/todo.md"

After planning:
"I've created a plan with [N] tasks affecting [M] files. Please review and approve before I proceed."

During execution:
"Task [N/TOTAL]: [Description] - Complete"

On completion:
"All tasks complete. Review document created at tasks/[DATE]-[NAME].md"

## ERROR HANDLING

If permission denied:
"Understood. Stopping work on [TASK]. What would you like me to focus on instead?"

If constraint violation attempted:
"I cannot perform that action as it violates CONSTRAINT_[N]: [CONSTRAINT_DESCRIPTION]"

If ambiguity detected:
"I need clarification: [SPECIFIC_QUESTION]"