# New Task Command

<anthropic_thinking_protocol>
enabled
</anthropic_thinking_protocol>

You are about to work on the next priority task from the project plan.

## Instructions:

### STEP 1: READ PROJECT CONTEXT
Read the following files to understand the project state:
1. `CLAUDE.md` - Development workflow and constraints
2. `PROJECT_PLAN.md` - Overall project goals and architecture
3. `PROJECT_PLAN_STATUS.md` - Current implementation status and next priority tasks

### STEP 2: IDENTIFY NEXT TASK
From PROJECT_PLAN_STATUS.md section "Next Priority Tasks":
- Identify the highest priority task that is marked as ⏳ PENDING
- Prioritize tasks in this order:
  1. "Critical/Blocking" tasks - Start here
  2. "High Priority" tasks
  3. "Medium Priority" tasks
  4. "Low Priority" tasks
- Skip any tasks marked as "User Tasks" or "Content Tasks" - those are for the user to complete

### STEP 3: PLAN THE WORK
**USE EXTENDED THINKING FOR THIS STEP**

Following CLAUDE.md workflow:
- Use TodoWrite to create a task plan
- Identify files that need to be modified
- List dependencies
- If the task requires modifying >3 files or creating new files, request approval before proceeding

<anthropic_thinking_protocol>
disabled
</anthropic_thinking_protocol>

### STEP 4: EXECUTE THE WORK
- Follow all ABSOLUTE CONSTRAINTS from CLAUDE.md
- Mark tasks as in_progress → completed in TodoWrite
- Make minimal, focused changes
- Test functionality if applicable

### STEP 5: REPORT COMPLETION
Provide a brief summary:
- What task was completed
- What files were modified
- Current project status
- Next recommended task (if obvious)

## Important Notes:
- Always follow the constraints in CLAUDE.md
- Use TodoWrite for all task tracking
- Follow CONSTRAINT_2: Request approval for changes outside the approved plan
- Current branch: **dev** (per CONSTRAINT_3 and CONSTRAINT_4)
