# Development Project Instructions

## ABSOLUTE CONSTRAINTS
These constraints override all other instructions:
- CONSTRAINT_1: **NEVER deploy to Cloud Run without explicit written permission containing the word "DEPLOY".** The following commands are FORBIDDEN without permission:
  - `gcloud run deploy`
  - `gcloud run services update`
  - Any command that pushes code/config to Cloud Run staging or production

  **Why this matters:** Deployments can break production, affect users, and should always be intentional. On 2026-01-28, a deployment was initiated without permission while adding webhook configuration. Always ASK before deploying, even if the build succeeds.
- CONSTRAINT_2: For changes outside the approved plan, stop immediately and request permission with justification
- CONSTRAINT_3: Always announce the current git branch at the beginning of each session and before making any major changes
- CONSTRAINT_4: Never merge or push to 'main' branch without explicit permission containing the word "MERGE" or "PUSH"
- CONSTRAINT_5: **NEVER run destructive database commands.** The following commands are FORBIDDEN without explicit written permission containing "RESET DATABASE":
  - `prisma db push --force-reset` (WIPES ALL DATA)
  - `prisma migrate reset` (WIPES ALL DATA)
  - `DROP DATABASE` or `DROP TABLE` commands
  - Any command with `--force-reset`, `--force`, or `--accept-data-loss` flags on database operations

  **Why this matters:** On 2026-01-20, `prisma db push --force-reset` was run to "fix schema drift" and it WIPED THE ENTIRE DATABASE. All projects, customers, products, users - everything was lost and had to be restored from staging.

- CONSTRAINT_6: **NEVER delete, overwrite, or modify the .env file without explicit written permission containing "DELETE ENV" or "MODIFY ENV".** The following actions are FORBIDDEN:
  - `rm .env` or any command that deletes .env
  - Overwriting .env with Write tool
  - Moving or renaming .env
  - Any bash command that removes, truncates, or destroys .env content

  **Why this matters:** The .env file contains critical API keys, database credentials, and configuration that cannot be recovered without manual intervention. Losing this file breaks the entire application.

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

**If using `/buildtask` command:** Skip local file creation - the buildtask workflow handles planning via ClickUp task updates and subtasks.

**For all other tasks:**
- **Simple tasks** (single file, <20 lines): Use TodoWrite tool only - no planning file needed.
- **Medium tasks** (2-3 files, <50 lines): Use TodoWrite tool for tracking.
- **Complex tasks** (>3 files OR >50 lines): Ask user: "This is a complex task. Would you like me to create a local planning file in `tasks/`, or should I just use the todo list?"

**If user wants a planning file**, use this structure:

**File location:** `tasks/[TASK_NAME]-[YYYY-MM-DD].md`

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

### Automated Testing with Playwright

**Navigate to:** `http://localhost:[PORT]` (use the actual port from STEP 5)

**Login Credentials:**
- Email: `devtest@sympatecoinc.com`
- Password: `password`


### STEP 6: COMPLETION
Update the planning file (if created) with:
- Mark all tasks complete: `- [x]`
- Fill in "Changes Made" section
- Fill in "Testing Performed" section
- Add any notes or observations

## DECISION RULES

IF task requires new file creation:
  THEN include in plan and request permission

IF using /buildtask command:
  THEN skip local task file - ClickUp handles planning

IF task affects >3 files OR >50 lines of code:
  THEN ask user if they want a local planning file, otherwise use TodoWrite

IF task is simple or medium (<3 files AND <50 lines):
  THEN use TodoWrite only, skip planning file

IF error occurs during execution:
  THEN stop, report error with full context, await instructions

IF user request conflicts with ABSOLUTE_CONSTRAINTS:
  THEN politely decline and explain the constraint

IF change needed outside approved plan:
  THEN stop and request permission per CONSTRAINT_2

IF schema drift detected OR migration fails:
  THEN NEVER use --force-reset or migrate reset
  INSTEAD: Use prisma migrate diff to understand the issue, create manual migration, or ASK USER for guidance
  SEE: DATABASE SAFETY section for proper handling

IF change affects existing APIs, database schemas, or interfaces:
  THEN ask user: "This change affects existing [APIs/schema/interfaces]. Should I add backwards compatibility support (e.g., deprecated fields, migration paths, fallback handling)?"

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

Starting work (any task):
"I'll analyze the codebase and create a task list."

For complex tasks (ask user):
"This is a complex task affecting [N] files. Would you like me to create a local planning file in `tasks/`, or should I just use the todo list?"

After planning:
"I've created a plan with [N] tasks affecting [M] files. Please confirm before I proceed."

During execution:
"Task [N/TOTAL]: [Description] - Complete"

On completion:
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

If schema drift or migration error:
"⚠️ DATABASE SCHEMA ISSUE DETECTED
Error: [ERROR_DETAILS]

I will NOT use --force-reset or any destructive commands. Safe options:
1. Create manual migration to fix drift
2. Use prisma migrate diff to diagnose
3. Sync schema from staging

Which approach would you like?"

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

## DATABASE SAFETY - CRITICAL

### FORBIDDEN COMMANDS (See CONSTRAINT_5)
These commands DESTROY DATA and are NEVER allowed without explicit permission:
```bash
# FORBIDDEN - These wipe all data:
npx prisma db push --force-reset    # DESTROYS ALL DATA
npx prisma migrate reset            # DESTROYS ALL DATA
npx prisma db push --accept-data-loss  # CAN DESTROY DATA
```

### How to Handle Schema Drift
When you see "schema drift detected" or migration errors, NEVER use `--force-reset`. Instead:

**Step 1: Understand the drift**
```bash
# Check what's different between schema and database
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

**Step 2: Create a migration to fix drift (safe approach)**
```bash
# Create migration file manually
mkdir -p prisma/migrations/$(date +%Y%m%d)_fix_schema_drift

# Copy the SQL from migrate diff output into migration.sql
# Then mark it as applied:
npx prisma migrate resolve --applied [MIGRATION_FOLDER_NAME]
```

**Step 3: If migration fails, ASK THE USER**
```
⚠️ PERMISSION REQUIRED
Issue: Schema drift detected - migrations cannot be applied cleanly
Options:
1. Create manual migration to fix drift (SAFE - preserves data)
2. Sync from staging database (SAFE - restores from backup)
3. Reset database (DESTROYS ALL DATA - requires explicit permission)

Which approach would you like me to take?
```

### Safe Commands
```bash
# These are SAFE and preserve data:
npx prisma migrate dev --name [name]  # Creates and applies new migration
npx prisma migrate deploy             # Applies pending migrations (production-safe)
npx prisma db push                    # WITHOUT --force-reset (schema sync, warns about data loss)
npx prisma generate                   # Regenerates client (no DB changes)
```

### Recovery
If data is lost, restore from staging:
1. Start Cloud SQL proxy: `~/cloud_sql_proxy linea-door-quoter:us-central1:door-app-staging --port 5434 &`
2. Use pg_dump/pg_restore or the /db-sync skills to restore data

**Local backup available:** `backups/staging_backup_2026-01-20.dump`
```bash
docker cp backups/staging_backup_2026-01-20.dump door-quoter_postgres_1:/tmp/backup.dump
docker exec door-quoter_postgres_1 pg_restore -U postgres -d door_quoter --clean --if-exists -F c /tmp/backup.dump
```

**Testing:**
- Run tests after significant changes
- Verify functionality manually when no tests exist
- Document test results

## DATE FORMAT STANDARD
Use ISO 8601 format throughout:
- File names: `YYYY-MM-DD`
- Documentation: `YYYY-MM-DD HH:MM`
- No other date formats
