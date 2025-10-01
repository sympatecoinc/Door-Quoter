# Name: Filter Swing Directions by Available Plan Views
# Date: 10-01-25

## Scope
Files to modify:
- src/app/api/products/route.ts: Include planViews in GET response
- src/components/views/ProjectDetailView.tsx: Show ONLY plan view names that exist for selected product; hide field entirely if no plan views

## Tasks
- [x] Task 1: Update products API to include planViews in response
- [x] Task 2: Extract plan view names from selected product's planViews array
- [x] Task 3: Replace hardcoded SWING_DIRECTIONS with dynamic options from product's plan view names
- [x] Task 4: Hide swing/sliding direction field entirely if product has no plan views
- [x] Task 5: Use exact plan view names as dropdown options (no filtering/matching against defaults)

## Success Criteria
- When a product is selected, dropdown shows ONLY the exact plan view names entered by user (e.g., if user created "Left-In" and "Right-In" plan views, only those two options appear)
- If a product has no plan views, the swing/sliding direction field is completely hidden
- Dropdown options are the exact strings from ProductPlanView.name field
- No default directions shown - only user-created plan view names
- Works for all product types that support plan views
