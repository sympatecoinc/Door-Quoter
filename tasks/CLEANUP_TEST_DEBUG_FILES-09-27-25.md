# Name: CLEANUP_TEST_DEBUG_FILES
# Date: 09-27-25

## Scope
Files to organize into new directories:

**Debug Files:**
- debug-extra-dollar.js: Move to debug/ folder
- debug-extrusion-pricing.js: Move to debug/ folder
- debug-pricing-issues.js: Move to debug/ folder
- debug-pricing.js: Move to debug/ folder

**Test Files:**
- test-db.js: Move to test/ folder
- test-options-api.js: Move to test/ folder
- test-second-extrusion-scenario.js: Move to test/ folder
- test-stock-rules.js: Move to test/ folder
- test_output.json: Move to test/ folder
- test_plan_output.json: Move to test/ folder
- test_sliding_output.json: Move to test/ folder

**Log Files:**
- All *.log files: Move to logs/ folder
- dev-proxy.log, prod-proxy.log, proxy-*.log, staging-proxy.log, server.log

**Temporary Files:**
- temp.html: Move to temp/ folder (or delete if not needed)

## Tasks
- [ ] Task 1: Create debug/ directory
- [ ] Task 2: Create test/ directory
- [ ] Task 3: Create logs/ directory
- [ ] Task 4: Create temp/ directory
- [ ] Task 5: Move all debug-*.js files to debug/
- [ ] Task 6: Move all test*.js and test*.json files to test/
- [ ] Task 7: Move all *.log files to logs/
- [ ] Task 8: Move temp.html to temp/ (or confirm deletion)
- [ ] Task 9: Update .gitignore to include new directories if needed

## Success Criteria
- Root directory contains no loose test/debug/log files
- All files organized into appropriate subdirectories
- Project structure is cleaner and more maintainable
- No functionality is broken by the reorganization