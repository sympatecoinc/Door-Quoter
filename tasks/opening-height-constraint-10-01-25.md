# Name: Opening Height Constraint
# Date: 10-01-25

## Scope
Files to modify:
- src/components/views/ProjectDetailView.tsx: Add logic to detect if opening has panels, extract height from first panel, disable height input for subsequent products

## Tasks
- [x] Task 1: When opening Add Component modal, check if the selected opening already has panels
- [x] Task 2: If opening has panels, extract the height from the first panel
- [x] Task 3: Disable the height input field and pre-populate it with the opening's established height
- [x] Task 4: Keep height field enabled if this is the first product being added to the opening
- [x] Task 5: Style disabled height field to appear greyed out

## Changes Made
- src/components/views/ProjectDetailView.tsx:330-356 - Added logic in handleShowAddComponent to check for existing panels and set height
- src/components/views/ProjectDetailView.tsx:1029-1058 - Updated height input to be disabled with greyed-out styling when opening has existing panels

## Testing Performed
- Manual testing required: Add first product to opening (height editable), then add second product (height should be disabled and show same value)

## Success Criteria
- First product added to an opening can set any height
- All subsequent products added to the same opening have the height field disabled and showing the established height
- Height value is greyed out/disabled visually
- Height field shows the correct height value from existing panels
- User cannot modify height for subsequent products
