# Development Project Instructions

## ABSOLUTE CONSTRAINTS
These constraints override all other instructions:
- CONSTRAINT_1: Never execute deployment to Cloud Run without explicit written permission containing the word "DEPLOY"
- CONSTRAINT_2: For changes outside the approved plan, stop immediately and request permission with justification
- CONSTRAINT_3: Always announce the current git branch at the beginning of each session and before making any major changes
- CONSTRAINT_4: Never merge or push to 'main' branch without explicit permission containing the word "MERGE" or "PUSH"

## BRANCH MANAGEMENT
- Always work on 'dev' branch unless instructed otherwise
- Never merge or push to 'main' without explicit permission
- Feature branches: `feature/[description]`
- Bug fixes: `fix/[description]`
- When in doubt about which branch to use, ask first

## WORKFLOW SEQUENCE

### STEP 1: ANALYSIS
When presented with a development task:
1. Read all relevant files in the codebase
2. Identify the minimal set of files requiring changes
3. Map dependencies between files
4. Output: List of files and their relationships

### STEP 2: PLANNING
For complex tasks (multiple files or >20 lines of changes), create a planning file:

**File location:** `tasks/[TASK_NAME]-[YYYY-MM-DD].md`

**Structure:**
```markdown
# [TASK_NAME]
Date: [YYYY-MM-DD]

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

## Changes Made
(Updated during execution)

## Testing Performed
(Updated after completion)

## Notes
(Any issues or observations)
```

For simple tasks (single file, <20 lines), use TodoWrite tool only - no planning file needed.

### STEP 3: APPROVAL CHECKPOINT
Present to user:
- The complete plan (either markdown file content or verbal summary)
- Explicit request: "Please confirm this plan before I proceed"
- Wait for user confirmation (any affirmative response)

### STEP 4: EXECUTION
**Tool Usage:**
- Use TodoWrite tool for real-time task tracking during execution
- Update markdown planning file as tasks complete (if one was created)
- Use Read/Edit/Write tools for file operations (never bash commands for file manipulation)

For each task:
1. Mark as in_progress in TodoWrite
2. Announce: "Starting: [TASK_DESCRIPTION]"
3. Make the minimal required change
4. Mark complete in TodoWrite
5. Report: "Completed: [TASK_DESCRIPTION] - [ONE_LINE_SUMMARY]"

If unexpected file modification is needed:
1. Stop immediately
2. Output: "⚠️ PERMISSION REQUIRED: Need to modify [FILE_PATH] because [REASON]"
3. Wait for explicit permission

### STEP 5: TESTING & VERIFICATION
After implementation:
1. Run development server if needed: `npm run dev`
2. Test the specific functionality changed
3. Run relevant test suites if they exist
4. Verify no unintended side effects
5. Document test results in planning file (if one exists)

### STEP 6: COMPLETION
Update the planning file (if created) with:
- Mark all tasks complete: `- [x]`
- Fill in "Changes Made" section
- Fill in "Testing Performed" section
- Add any notes or observations

## DECISION RULES

IF task requires new file creation:
  THEN include in plan and request permission

IF task affects >3 files OR >50 lines of code:
  THEN create planning file in tasks/ directory

IF task is simple (<3 files AND <20 lines):
  THEN use TodoWrite only, skip planning file

IF error occurs during execution:
  THEN stop, report error with full context, await instructions

IF user request conflicts with ABSOLUTE_CONSTRAINTS:
  THEN politely decline and explain the constraint

IF change needed outside approved plan:
  THEN stop and request permission per CONSTRAINT_2

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
6. Scale formality to task complexity

## COMMUNICATION TEMPLATES

Session start/Branch announcement:
"Current branch: [branch_name]"

Starting work (complex task):
"I'll analyze the codebase and create a plan in tasks/[TASK_NAME]-[YYYY-MM-DD].md"

Starting work (simple task):
"I'll analyze the codebase and create a task list"

After planning:
"I've created a plan with [N] tasks affecting [M] files. Please confirm before I proceed."

During execution:
"Task [N/TOTAL]: [Description] - Complete"

On completion (with planning file):
"All tasks complete. Review document available at tasks/[TASK_NAME]-[YYYY-MM-DD].md"

On completion (simple task):
"All tasks complete."

## ERROR HANDLING

If permission denied:
"Understood. Stopping work on [TASK]. What would you like me to focus on instead?"

If constraint violation attempted:
"I cannot perform that action as it violates CONSTRAINT_[N]: [CONSTRAINT_DESCRIPTION]"

If ambiguity detected:
"I need clarification: [SPECIFIC_QUESTION]"

If test/build fails:
"[TEST/BUILD] failed with error: [ERROR_DETAILS]. Should I investigate and fix, or would you like to handle this?"

## DEVELOPMENT WORKFLOW

**Running the dev server:**
- Command: `npm run dev`
- Run when testing UI/frontend changes
- Keep running in background during development

**Database operations:**
- Migrations: `npx prisma migrate dev`
- Always verify database connection before schema changes
- Test database operations after migrations
- **For database connection setup:** See `MANUAL_DATABASE_MIGRATION_GUIDE.md` for complete instructions on establishing Cloud SQL proxy connections to staging/production databases

**Testing:**
- Run tests after significant changes
- Verify functionality manually when no tests exist
- Document test results

## DATE FORMAT STANDARD
Use ISO 8601 format throughout:
- File names: `YYYY-MM-DD`
- Documentation: `YYYY-MM-DD HH:MM`
- No other date formats
