# Debug - Automated Diagnostic & Fix Workflow

Comprehensively diagnose application issues, analyze with thinking mode, and systematically fix with automated Playwright verification.

## Overview

This command will:
1. Run automated diagnostic tests
2. Analyze failures using extended thinking mode
3. Create a prioritized fix plan
4. Implement fixes systematically
5. Verify fixes with Playwright automated testing
6. Document the entire debug session

---

## STEP 1: Initial Diagnostics

### 1.1 Announce Debug Session Start

Present to user:
```
🔍 Starting comprehensive debug session...

I'll systematically:
1. Run all diagnostic tests
2. Analyze failures with thinking mode
3. Create a fix plan
4. Implement fixes
5. Verify with Playwright testing
6. Document results

This may take several minutes depending on issues found.
```

### 1.2 Run Test Suite

Execute all available tests and collect results:

```bash
# Database connectivity test
node test/test-db.js

# Options API test
node test/test-options-api.js

# Stock rules test
node test/test-stock-rules.js

# Second extrusion scenario test
node test/test-second-extrusion-scenario.js
```

**For each test:**
- Capture exit code (0 = pass, non-zero = fail)
- Capture full output (stdout and stderr)
- Note execution time
- Categorize results: PASS, FAIL, or ERROR

### 1.3 Application Health Checks

Run comprehensive health checks:

```bash
# TypeScript type checking
npx tsc --noEmit

# Linting
npm run lint

# Build check
npm run build
```

**Collect:**
- All error messages
- Warning messages
- File paths with issues
- Line numbers for errors

### 1.4 Database Health Check

Verify database integrity:

```bash
# Check Prisma schema validity
npx prisma validate

# Check for pending migrations
npx prisma migrate status
```

### 1.5 Create Diagnostic Summary

Compile all findings into structured format:

```markdown
## Diagnostic Results

### Test Suite Results
- ✅ test-db.js: PASS
- ❌ test-options-api.js: FAIL (exit code 1)
- ✅ test-stock-rules.js: PASS
- ⚠️ test-second-extrusion-scenario.js: ERROR (exception thrown)

### Build Health
- ❌ TypeScript: 3 errors found
- ⚠️ Lint: 5 warnings
- ❌ Build: Failed due to type errors

### Database Health
- ✅ Schema: Valid
- ⚠️ Migrations: 1 pending migration

### Summary
- **Critical Issues:** [count]
- **Warnings:** [count]
- **Tests Passing:** [count]/[total]
```

Present this summary to the user.

---

## STEP 2: Deep Analysis with Thinking Mode

### 2.1 Activate Extended Thinking

IMPORTANT: Engage extended thinking mode for thorough root cause analysis.

When analyzing, focus on:
- **Pattern Recognition:** Do multiple errors share a common cause?
- **Root Cause vs Symptoms:** Which errors are cascading from others?
- **Dependency Analysis:** What must be fixed first?
- **Impact Assessment:** Which issues block critical functionality?
- **Risk Evaluation:** What are the risks of each fix approach?

### 2.2 Analyze Each Failure

For each failed test or error:

**Extract Key Information:**
- Error message
- Stack trace
- File and line number
- Context (what was being tested)

**Investigate Root Cause:**
- Read the failing test file
- Read the source file(s) involved
- Understand the expected vs actual behavior
- Identify the specific code causing the issue
- Determine if this is a symptom of a deeper issue

**Assess Impact:**
- What functionality is broken?
- Does this block other features?
- Is this a regression or existing issue?
- How many users are affected?

### 2.3 Categorize Issues

Group issues by:

**Priority Levels:**
- **CRITICAL:** Application crashes, data loss, core features broken
- **HIGH:** Important features degraded, API errors, type safety issues
- **MEDIUM:** UI issues, non-critical warnings, performance problems
- **LOW:** Lint warnings, code style, minor inconsistencies

**Issue Types:**
- **Type Errors:** TypeScript compilation failures
- **Runtime Errors:** Exceptions thrown during execution
- **Logic Errors:** Code runs but produces wrong results
- **Validation Errors:** Missing/incorrect input validation
- **API Errors:** Backend endpoint failures
- **Database Errors:** Schema issues, query failures
- **Build Errors:** Compilation or bundling failures

### 2.4 Map Dependencies

Create a dependency graph:

```
Issue A (critical) → Must fix before Issue B
                  → Blocks Issue C
Issue D (high) → Independent, can fix in parallel
Issue E (low) → Cosmetic, fix last
```

### 2.5 Devise Fix Strategy

For each issue, plan:

**What needs to change:**
- Specific files to modify
- Approximate line numbers
- Type of change (add validation, fix type, update logic)

**How to change it:**
- Minimal code modification approach
- Avoid cascading changes where possible
- Maintain backward compatibility

**How to test it:**
- Which test should pass after fix
- Additional manual verification needed
- Edge cases to consider

### 2.6 Create Prioritized Fix Plan

Order fixes by:
1. **Blockers first:** Fixes that unblock other fixes
2. **Critical path:** Fixes for core functionality
3. **High value:** Fixes that resolve multiple issues
4. **Quick wins:** Simple fixes with high impact
5. **Low priority:** Non-critical improvements

Present the plan in this format:

```markdown
## Fix Plan - [N] Issues Identified

### Priority Order

**Fix 1: [TITLE]** (CRITICAL)
- **Issue:** [Brief description]
- **Root Cause:** [Technical explanation]
- **Solution:** [What will be changed]
- **Files:** [List of files]
- **Tests:** [How to verify]
- **Dependencies:** [What this unblocks]
- **Estimated Complexity:** Simple/Medium/Complex

**Fix 2: [TITLE]** (HIGH)
[Same structure...]

[Continue for all fixes...]

### Summary
- Total fixes planned: [N]
- Files to modify: [N] unique files
- Estimated time: [X] hours
- Tests to verify: [N] automated + manual verification
```

---

## STEP 3: Get User Approval

### 3.1 Present Complete Analysis

Show the user:
1. Diagnostic summary (from Step 1)
2. Analysis findings (from Step 2)
3. Complete fix plan with priorities

### 3.2 Request Approval

Use the AskUserQuestion tool with these questions:

**Question 1:**
- **Header:** "Proceed?"
- **Question:** "Should I proceed with this fix plan? This will modify [N] files and run [N] fixes."
- **Options:**
  - "Yes, proceed with all fixes" - Execute full plan
  - "Yes, but only critical/high priority" - Skip low priority items
  - "Let me review the plan first" - Pause for user review
  - "No, I'll fix manually" - Exit command

**Question 2 (if applicable):**
- **Header:** "Priority"
- **Question:** "Are there any specific areas you want me to prioritize or skip?"
- **Options:**
  - "Fix in the order proposed" - Follow plan
  - "Focus on [specific area] first" - Reorder priorities
  - "Skip database migrations for now" - Avoid schema changes
  - "Only fix test failures" - Skip build/lint issues

### 3.3 Adjust Plan Based on Feedback

If user requests changes:
- Reorder priorities
- Remove out-of-scope items
- Add additional focus areas
- Update TodoWrite list accordingly

---

## STEP 4: Systematic Fix Implementation

### 4.1 Initialize Task Tracking

Use TodoWrite to create a task for each fix from the approved plan:

```
[
  {"content": "Fix 1: [Title]", "status": "pending", "activeForm": "Fixing [title]"},
  {"content": "Fix 2: [Title]", "status": "pending", "activeForm": "Fixing [title]"},
  ...
]
```

### 4.2 Execute Fixes in Order

For each fix:

**4.2.1 Start Task**
- Update TodoWrite: Mark as `in_progress`
- Announce: "Starting Fix [N/TOTAL]: [TITLE]"

**4.2.2 Read Context**
- Use Read tool on all files involved
- Review surrounding code
- Understand current implementation

**4.2.3 Implement Fix**
- Use Edit tool for precise changes
- Make minimal modifications
- Follow existing code patterns
- Maintain code style consistency
- Add comments if logic is complex

**4.2.4 Quick Verification**
After critical fixes, run quick check:
```bash
# If type error fix
npx tsc --noEmit

# If test fix
node test/[specific-test].js

# If build fix
npm run build
```

**4.2.5 Complete Task**
- Update TodoWrite: Mark as `completed`
- Report: "Completed Fix [N/TOTAL]: [SUMMARY]"
- Note: "[SPECIFIC_CHANGE_MADE]"

### 4.3 Handle Unexpected Issues

If new issues discovered during fix:

**Stop immediately and:**
1. Document the new issue
2. Assess if it's blocking
3. Update TodoWrite with new task
4. Inform user: "⚠️ DISCOVERED: [NEW_ISSUE] - [RECOMMENDATION]"
5. Get permission to expand scope or continue

### 4.4 Track Dependencies

As fixes complete:
- Note which downstream fixes are now unblocked
- Verify no cascading breakage
- Adjust remaining fix order if needed

---

## STEP 5: Automated Verification with Playwright

### 5.1 Start Development Server

```bash
# Start dev server in background
npm run dev
```

Wait for server to be ready and note the port (usually 3000).

### 5.2 Initialize Playwright

Check if Playwright is installed:
```bash
npx playwright install
```

### 5.3 Authentication Test

**Test Case: Login**
1. Navigate to: `http://35.225.66.30:[PORT]`
2. Wait for page load
3. Take snapshot
4. Find login form
5. Type email: `kyle.goevert@sympatecoinc.com`
6. Type password: `Caramia458`
7. Click login button
8. Wait for navigation
9. Verify successful login (check for user menu or projects page)
10. Check console for errors
11. Take screenshot: `debug-login-success.png`

**Expected Result:**
- ✅ Login successful
- ✅ Redirected to projects or dashboard
- ✅ No console errors

**If Fails:**
- Document error
- Take screenshot of failure
- Note in report

### 5.4 Core Functionality Tests

**Test Case 1: Projects View**
1. Navigate to projects view
2. Take snapshot
3. Verify projects list loads
4. Click "New Project" button (if exists)
5. Verify modal/form opens
6. Check console for errors
7. Take screenshot

**Test Case 2: Opening Management**
1. Navigate to a project
2. Take snapshot
3. Verify openings list loads
4. Test creating/editing an opening
5. Verify calculations work
6. Check data persists
7. Take screenshot

**Test Case 3: Master Parts**
1. Navigate to Master Parts view
2. Take snapshot
3. Verify parts list loads
4. Test search/filter functionality
5. Check console for errors
6. Take screenshot

**Test Case 4: Quote Generation**
1. Navigate to project with openings
2. Click generate quote
3. Verify quote generates successfully
4. Check PDF preview works
5. Take screenshot

### 5.5 Specific Issue Verification

For each fix that was implemented, create a targeted test:

**Template:**
```
Test: Verify Fix [N] - [TITLE]

Issue that was fixed:
[Original error/problem]

Test steps:
1. Navigate to [affected area]
2. Perform [action that was broken]
3. Verify [expected behavior]
4. Check [specific data/calculation]

Expected result:
✅ [Original issue no longer occurs]
✅ [Feature works as intended]
✅ No console errors
✅ No regression in related features

Take screenshot: debug-fix-[N]-verification.png
```

### 5.6 Edge Case Testing

Test boundary conditions:

**Validation Tests:**
- Submit forms with missing required fields
- Submit invalid data types
- Test maximum length inputs
- Test special characters

**Error Handling Tests:**
- Trigger error conditions
- Verify error messages display
- Verify graceful degradation
- Verify no data corruption

**State Management Tests:**
- Test data persistence
- Test undo/redo if applicable
- Test concurrent operations
- Test page refresh behavior

### 5.7 Console Error Check

Throughout all tests:
```
Use browser_console_messages with onlyErrors: true
```

Document any console errors found.

### 5.8 Collect Test Results

Create structured test report:

```markdown
## Playwright Verification Results

### Authentication
✅ Login successful
✅ Session persists
✅ No console errors

### Core Functionality
✅ Projects view: PASS
✅ Opening management: PASS
✅ Master parts: PASS
✅ Quote generation: PASS

### Fix Verification
✅ Fix 1: [Title] - VERIFIED
✅ Fix 2: [Title] - VERIFIED
⚠️ Fix 3: [Title] - PARTIAL (see notes)
❌ Fix 4: [Title] - FAILED (see details)

### Edge Cases
✅ Form validation: PASS
✅ Error handling: PASS
✅ Data persistence: PASS

### Console Errors
✅ No critical errors
⚠️ 1 warning: [description]

### Screenshots Captured
- debug-login-success.png
- debug-fix-1-verification.png
- debug-fix-2-verification.png
[etc...]
```

---

## STEP 6: Handle Test Failures

### 6.1 Analyze Failures

If any tests fail:

**For each failure:**
1. Review the test output
2. Examine screenshots
3. Check console errors
4. Read the relevant code again

**Determine:**
- Was the fix incomplete?
- Is there a different root cause?
- Did the fix introduce a regression?
- Is the test expectation wrong?

### 6.2 Re-engage Thinking Mode

Use extended thinking to:
- Understand why the fix didn't work
- Identify alternative approaches
- Consider side effects not previously seen
- Plan corrective action

### 6.3 Implement Corrective Fix

If fix is needed:
1. Update TodoWrite with new task
2. Implement corrective changes
3. Re-run affected tests
4. Verify resolution

### 6.4 Iterate Until Critical Tests Pass

**Stopping Criteria:**
- All CRITICAL issues resolved
- All HIGH priority tests passing
- No console errors
- Core functionality verified

**If stuck:**
- Document the blocker
- Provide analysis to user
- Request guidance or permission to try alternative approach

---

## STEP 7: Final Report & Documentation

### 7.1 Calculate Time Tracking

Note the total time spent:
- Analysis time
- Implementation time
- Testing time
- Total elapsed time

### 7.2 Generate Comprehensive Report

Create detailed summary:

```markdown
# Debug Session Report - [YYYY-MM-DD]

## Executive Summary
- **Total Issues Found:** [N]
- **Issues Fixed:** [N]
- **Issues Remaining:** [N]
- **Tests Passing:** [N]/[total]
- **Time Spent:** [X] hours

---

## Diagnostic Results

### Initial State
[Summary from Step 1 diagnostics]

### Issues Identified
**Critical (fixed):**
- ✅ [Issue 1]: [Description]
- ✅ [Issue 2]: [Description]

**High (fixed):**
- ✅ [Issue 3]: [Description]

**Medium (fixed):**
- ✅ [Issue 4]: [Description]

**Low (not fixed - by design):**
- ⚠️ [Issue 5]: [Description] - [Reason skipped]

---

## Fixes Applied

### Fix 1: [Title]
**Issue:** [Original problem]
**Root Cause:** [Technical explanation]
**Solution:** [What was changed]
**Files Modified:**
- `path/to/file1.ts` (lines X-Y)
- `path/to/file2.tsx` (lines A-B)
**Verification:** ✅ PASS
**Notes:** [Any additional context]

### Fix 2: [Title]
[Same structure...]

[Continue for all fixes...]

---

## Files Modified

### Summary
- **Total files:** [N]
- **Lines changed:** ~[approximate]
- **New files:** [N]
- **Deleted files:** [N]

### Detailed List
- `src/app/api/options/route.ts`
  - Added null check for request body
  - Added input validation
  - Lines: 45-52, 67-73

- `src/types/opening.ts`
  - Fixed type mismatch in Opening interface
  - Updated width/height to accept string | number
  - Lines: 12-15

[Continue for all files...]

---

## Test Results

### Automated Tests
✅ test-db.js: PASS
✅ test-options-api.js: PASS (was failing)
✅ test-stock-rules.js: PASS
✅ test-second-extrusion-scenario.js: PASS (was erroring)

### Build Health
✅ TypeScript: 0 errors (was 3)
✅ Lint: 2 warnings (was 5)
✅ Build: SUCCESS (was failing)

### Playwright Verification
✅ Authentication: PASS
✅ Projects view: PASS
✅ Opening management: PASS
✅ Master parts: PASS
✅ Quote generation: PASS
✅ All fixes verified: PASS
✅ Edge cases: PASS
✅ No console errors: PASS

### Screenshots
All verification screenshots saved to:
- `.playwright-mcp/debug-login-success.png`
- `.playwright-mcp/debug-fix-1-verification.png`
- `.playwright-mcp/debug-fix-2-verification.png`
[etc...]

---

## Remaining Issues

### Known Issues Not Addressed
1. **[Issue Title]** (Priority: LOW)
   - **Description:** [Details]
   - **Why Not Fixed:** [Reason - e.g., out of scope, requires design decision]
   - **Recommendation:** [What should be done]
   - **Impact:** [Minimal/None/etc.]

[Continue for any remaining issues...]

---

## Technical Debt Identified

During this debug session, the following technical debt was identified:

1. **[Area]:** [Description]
   - **Impact:** [Current/Potential]
   - **Recommendation:** [Suggestion for improvement]

[Continue...]

---

## Recommendations

### Immediate Actions
- [Action 1]
- [Action 2]

### Preventive Measures
- Add test coverage for [area]
- Implement validation for [feature]
- Update documentation for [component]

### Future Improvements
- Consider refactoring [module]
- Investigate performance of [feature]
- Evaluate alternative approach for [functionality]

---

## Time Breakdown
- **Initial Diagnostics:** [X] minutes
- **Analysis (with thinking mode):** [X] minutes
- **Implementation:** [X] minutes
- **Playwright Testing:** [X] minutes
- **Documentation:** [X] minutes
- **Total:** [X] hours

---

## Conclusion

[Brief summary of what was accomplished and current state of application]

**Status:** ✅ All critical issues resolved, application healthy

**Next Steps:** [What user should do next, if anything]

---

*Debug session completed: [TIMESTAMP]*
*Generated by /debug command*
```

### 7.3 Save Debug Session Log

Save the complete report to:
```
tasks/debug-session-[YYYY-MM-DD]-[HH-MM].md
```

### 7.4 Present Summary to User

Show concise summary:

```markdown
## ✅ Debug Session Complete

**Status:** All critical issues resolved

### Summary
- **Issues Fixed:** [N] critical, [N] high priority
- **Tests:** All passing ✅
- **Build:** Clean ✅
- **Verification:** Playwright tests all passing ✅

### Files Modified
- [N] files changed
- ~[N] lines modified

### Documentation
Complete report saved to: `tasks/debug-session-[YYYY-MM-DD]-[HH-MM].md`

### Remaining Actions
[If any low-priority items remain:]
- [Action 1] (LOW priority - can address later)
- [Action 2] (Cosmetic - optional)

**Application is now healthy and ready for use!** 🎉
```

---

## Error Handling

### Test Execution Errors

**If test command fails to execute:**
- Log the error
- Continue with other tests
- Note in report that test couldn't run
- Don't block entire debug session

### Analysis Paralysis

**If analysis takes too long:**
- Set a time limit (5 minutes for analysis)
- Make best judgment based on available info
- Proceed with high-confidence fixes
- Flag uncertain areas for user review

### Fix Implementation Errors

**If edit fails:**
- Document the error
- Skip to next fix
- Note in final report
- Provide manual fix instructions

### Playwright Errors

**If browser automation fails:**
- Take screenshot of error
- Document failure
- Attempt manual verification instructions
- Don't block report generation

### Permission Violations

**If attempting to modify unexpected files:**
- Stop immediately
- Report: "⚠️ PERMISSION REQUIRED: Need to modify [FILE] because [REASON]"
- Wait for user approval
- Don't proceed without permission per CONSTRAINT_2

---

## Important Constraints

**From CLAUDE.md:**
- CONSTRAINT_1: Never deploy without explicit "DEPLOY" permission
- CONSTRAINT_2: Stop and request permission for out-of-scope changes
- CONSTRAINT_3: Announce current git branch
- CONSTRAINT_4: Never merge to main without "MERGE"/"PUSH" permission

**Debug-Specific:**
- Always run diagnostics first before fixing
- Get user approval before implementing fixes
- Use TodoWrite for all task tracking
- Verify every fix with automated tests
- Document everything comprehensively
- Never skip critical test verification
- Stop if major architectural changes needed

---

## Notes

- This command can take 15-60 minutes depending on issues found
- Thinking mode analysis is critical - don't rush it
- Playwright verification is mandatory for all critical fixes
- Always save comprehensive documentation
- If user needs to leave, save progress in tasks/ directory
- Can resume by reviewing the saved report

---

## Success Criteria

**Debug session is successful when:**
- ✅ All critical issues resolved
- ✅ All high-priority tests passing
- ✅ Build succeeds with no errors
- ✅ TypeScript compilation clean
- ✅ Playwright verification passes
- ✅ No console errors in browser
- ✅ Core functionality works end-to-end
- ✅ Complete documentation generated
- ✅ User is informed and satisfied

---

*This command combines automated testing, AI-powered analysis, systematic fixes, and real browser verification to ensure application health.*
