# Build Task - ClickUp Task Breakdown Workflow

You will help break down a ClickUp task into a comprehensive implementation plan with detailed subtasks.

## Instructions

### Step 1: Get the Task ID

First, ask the user for the ClickUp task ID:

"What's the ClickUp task ID you'd like me to build out?"

Wait for the user to provide the task ID.

### Step 2: Fetch and Analyze the Task

Once you have the task ID, fetch the task details:

```bash
node scripts/clickup-helper.js task <TASK_ID>
```

**Extract from the task:**
- Task name
- Current description
- Status
- Assignee
- Priority
- Due date

### Step 3: Understand the Codebase Context

Analyze the codebase to understand what needs to be changed:

**Questions to Answer:**
- Which files need to be modified?
- What is the current implementation?
- Are there related files (tests, types, etc.)?
- What's the data flow (frontend → API → database)?

**Use appropriate tools:**
- Use Glob to find relevant files
- Read component files, API routes, types
- Check database schema if needed (prisma/schema.prisma)
- Search for related functionality with Grep

### Step 4: Ask Clarifying Questions

Before proceeding with the implementation plan, use the AskUserQuestion tool to ask any clarifying questions:
- Implementation approach (if multiple valid options exist)
- Technical choices (libraries, patterns, etc.)
- Scope decisions (what's in scope vs. out of scope)
- Any ambiguities in the requirements

**Only proceed after getting answers to your questions.**

### Step 5: Create Implementation Plan

Update the main ClickUp task with a detailed implementation plan:

```bash
node scripts/clickup-helper.js update <TASK_ID> --append-description "<IMPLEMENTATION_PLAN>"
```

**Implementation plan should include:**

```markdown
## Implementation Plan

### Files to Modify
1. **Frontend**: `path/to/component.tsx`
2. **Backend API**: `path/to/route.ts`
3. **Types** (if needed): `path/to/types.ts`
4. **Database** (if needed): `prisma/schema.prisma`

---

## Detailed Changes

### 1. Component Changes (`component.tsx`)

**Current State:**
- Brief description of current behavior
- Any limitations or issues

**Changes Required:**

**A. Update Feature X (Line ~XXX)**
```typescript
// Change from:
currentCode()

// To:
newCode()
```

**B. Add Validation (Line ~XXX)**
```typescript
// Add this:
newValidation()
```

---

### 2. API Changes (`route.ts`)

**Current State:**
- Current API behavior

**Changes Required:**

**A. Add Validation**
```typescript
if (!requiredField) {
  return NextResponse.json(
    { error: 'Field is required' },
    { status: 400 }
  )
}
```

---

## Testing Steps

### Test Case 1: [Name]

**Steps:**
1. Do thing A
2. Do thing B
3. Verify outcome C

**Expected Result:**
- Specific expected outcome
- No errors
- Data persists correctly

---

## Rollback Plan

If issues arise:
1. Revert file changes
2. Redeploy previous version
3. Document issues
```

### Step 6: Add Initial Comment

Add a summary comment to the task:

```bash
node scripts/clickup-helper.js comment <TASK_ID> "<COMMENT_TEXT>"
```

**Comment format:**
```markdown
## Implementation Plan Created ✅

I've analyzed the codebase and created a detailed implementation plan.

### Summary of Changes

**X Files Need Modification:**
1. **Frontend** (`component.tsx`): Brief description
2. **Backend API** (`route.ts`): Brief description

### Key Implementation Points

✅ **Simple/Complex** - Complexity assessment
✅ **Safe** - No breaking changes / schema changes required
✅ **Complete** - Full coverage of requirements
✅ **Tested** - X test cases included

Ready to create subtasks!
```

### Step 7: Create Subtasks

Based on the complexity, create appropriate subtasks. Common patterns:

#### Pattern 1: Simple Feature (3 subtasks)
1. Frontend Implementation
2. Frontend Testing
3. Deployment

#### Pattern 2: Full Stack Feature (5 subtasks)
1. Frontend Implementation
2. Backend Implementation
3. Frontend Testing
4. Backend Testing
5. Deployment & Documentation

#### Pattern 3: Complex Feature with DB (6 subtasks)
1. Database Migration
2. Backend API
3. Frontend Implementation
4. Frontend Testing
5. Backend Testing
6. Deployment & Documentation

**Create each subtask:**

```bash
node scripts/clickup-helper.js subtask <PARENT_TASK_ID> "<SUBTASK_NAME>" "<SUBTASK_DESCRIPTION>"
```

### Subtask Templates

#### Frontend Implementation Subtask

**Name:** `Frontend: [Specific Feature Name]`

**Description:**
```markdown
## Summary
Brief 1-2 sentence summary of what this subtask accomplishes.

## Prompt
Clear instruction: "Update `path/to/file.tsx` to [do specific thing]."

## Changes Required

### 1. Update [Feature] (Line ~XXX)
Description of change:
```typescript
// Change from:
oldCode()

// To:
newCode()
```

### 2. Add [Feature] (Line ~XXX)
Description of change:
```typescript
// Add this:
newCode()
```

## Acceptance Criteria
- [ ] Feature X works as expected
- [ ] No console errors
- [ ] Visual indicator shows correct state
- [ ] Form validation works
- [ ] Submit button logic correct

## Files Modified
- `path/to/file.tsx`

## Related Task
Part of: https://app.clickup.com/t/<PARENT_TASK_ID>
```

#### Backend API Subtask

**Name:** `Backend: [Specific API Change]`

**Description:**
```markdown
## Summary
Brief description of API changes.

## Prompt
Update `path/to/route.ts` to [specific instruction].

## Changes Required

### 1. Add Validation (After Line ~XXX)
```typescript
if (!requiredField) {
  return NextResponse.json(
    { error: 'Field is required' },
    { status: 400 }
  )
}
```

### 2. Update Data Creation (Line ~XXX)
```typescript
// Change from:
oldImplementation()

// To:
newImplementation()
```

## Acceptance Criteria
- [ ] API returns correct status codes
- [ ] Error messages are clear
- [ ] Valid requests work correctly
- [ ] Invalid requests rejected with proper errors
- [ ] No unintended side effects

## Testing Command
```javascript
fetch('/api/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    // test data
  })
})
.then(r => r.json())
.then(console.log)
```

**Expected Response:**
```json
{
  "error": "Expected error message"
}
```

## Files Modified
- `path/to/route.ts`

## Related Task
Part of: https://app.clickup.com/t/<PARENT_TASK_ID>
```

#### Frontend Testing Subtask

**Name:** `Testing: [Component] User Experience`

**Description:**
```markdown
## Summary
Verify frontend functionality and user experience.

## Prompt
Execute manual testing to confirm [specific feature] works correctly.

## Test Prerequisites
- [ ] Development environment running
- [ ] Test data available
- [ ] Can access feature area

## Test Case 1: [Primary Happy Path]

**Steps:**
1. Navigate to X
2. Click Y
3. Fill in Z
4. Submit

**Expected Results:**
- [ ] Action completes successfully
- [ ] UI updates correctly
- [ ] No errors in console
- [ ] Data persists

## Test Case 2: [Validation Scenario]

**Steps:**
1. Navigate to X
2. Leave required field blank
3. Attempt submit

**Expected Results:**
- [ ] Form does NOT submit
- [ ] Validation message appears
- [ ] UI indicates error state
- [ ] No API call made

## Pass Criteria
All test cases must pass before marking complete.

## Related Task
Part of: https://app.clickup.com/t/<PARENT_TASK_ID>
```

#### Backend Testing Subtask

**Name:** `Testing: API Validation & Edge Cases`

**Description:**
```markdown
## Summary
Verify backend validation and edge case handling.

## Prompt
Execute API-level testing using browser console to confirm server-side validation.

## Test Prerequisites
- [ ] Development environment running
- [ ] Browser developer tools accessible

## Test Case 1: API Validation

**Steps:**
1. Open browser developer tools (F12)
2. Navigate to Console tab
3. Execute:
```javascript
fetch('/api/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    // invalid data
  })
})
.then(async r => ({
  status: r.status,
  data: await r.json()
}))
.then(console.log)
```

**Expected Results:**
- [ ] API returns 400 status code
- [ ] Error message: "Expected message"
- [ ] No data created in database

## Pass Criteria
All tests pass with expected results.

## Related Task
Part of: https://app.clickup.com/t/<PARENT_TASK_ID>
```

#### Deployment Subtask

**Name:** `Deployment: Production Release & Documentation`

**Description:**
```markdown
## Summary
Deploy feature to production and update documentation.

## Prompt
Deploy changes to production, verify functionality, and update documentation.

## Deployment Checklist

### Pre-Deployment
- [ ] All subtasks completed
- [ ] Frontend tests passed
- [ ] Backend tests passed
- [ ] Edge cases validated
- [ ] No console errors

### Deployment Steps
1. [ ] Merge to main branch
2. [ ] Deploy to production
3. [ ] Monitor for errors (30 minutes)

### Post-Deployment Verification

**Test in Production:**
1. [ ] Navigate to feature
2. [ ] Execute primary workflow
3. [ ] Verify data persists
4. [ ] Check for errors
5. [ ] Confirm expected behavior

### Documentation Updates

**1. Update CHANGELOG** (if applicable)
- [ ] Document new feature/change
- [ ] Note any breaking changes

## Rollback Plan

If critical issues:
1. [ ] Identify issue
2. [ ] Revert changes
3. [ ] Redeploy previous version
4. [ ] Document in ClickUp

## Success Criteria
- [ ] Deployed to production
- [ ] All tests pass
- [ ] No critical errors

## Related Task
Part of: https://app.clickup.com/t/<PARENT_TASK_ID>
```

### Step 8: Add Final Summary Comment

After creating all subtasks, add a final summary comment:

```bash
node scripts/clickup-helper.js comment <PARENT_TASK_ID> "<SUMMARY_COMMENT>"
```

**Summary format:**
```markdown
## Subtasks Created! ✅

I've broken down this feature into **X actionable subtasks** with detailed prompts, acceptance criteria, and testing steps.

### Subtask Workflow

**1. [Subtask Name]**
- Key point 1
- Key point 2

**2. [Subtask Name]**
- Key point 1
- Key point 2

[... continue for all subtasks ...]

---

### Implementation Order
1. Complete [Subtask 1]
2. Complete [Subtask 2]
3. Complete [Subtask 3]
4. Complete [Subtask 4]
5. Complete [Subtask 5]

### Each Subtask Includes:
✅ Clear summary
✅ Detailed prompt with exact instructions
✅ Specific code changes with line numbers
✅ Acceptance criteria checklist
✅ Testing commands/procedures
✅ Links to related tasks

All subtasks are ready to be worked on sequentially!
```

## Important Notes

- Be thorough in your analysis before creating the plan
- Include specific line numbers when possible
- Provide exact code examples
- Make subtasks actionable (30-60 minutes each)
- Test everything comprehensively
- Link all related tasks
- Follow the patterns appropriate for the complexity level
- Use the ClickUp helper script for all API operations
