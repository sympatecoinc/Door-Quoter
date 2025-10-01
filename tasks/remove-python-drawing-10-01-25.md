# Name: Remove Python Drawing Code
# Date: 10-01-25

## Scope
Files to modify:
- src/app/api/drawings/elevation/[openingId]/route.ts: Remove unused generateDrawing function and spawn imports
- src/app/api/drawings/plan/[openingId]/route.ts: Remove unused generateDrawing function and spawn imports
- src/app/api/projects/[id]/complete-package/route.ts: Check if spawn is used for Python drawings, remove if applicable
- src/app/api/projects/[id]/quote/route.ts: Check if spawn is used for Python drawings, remove if applicable

## Tasks
- [x] Task 1: Remove generateDrawing function and related imports from elevation route
- [x] Task 2: Remove generateDrawing function and related imports from plan route
- [x] Task 3: Review and remove Python drawing code from complete-package route if present
- [x] Task 4: Review and remove Python drawing code from quote route if present

## Success Criteria
- No unused Python drawing generation code remains in the API routes
- spawn and child_process imports removed where not needed
- All routes still function correctly for their intended purposes
