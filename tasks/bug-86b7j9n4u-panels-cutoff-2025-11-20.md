# Bottom of Panels Getting Cut Off
Date: 2025-11-20

## Problem
The bottom of panels are getting cut off in the shop drawing elevation view when panels are NOT 96"+ tall. For example, 88" tall panels get cut off.

## Root Cause
In `DrawingViewer.tsx` (line 304), the elevation view container has a fixed `minHeight: '400px'` style. The rendering logic calculates display dimensions using a fixed scale (4 pixels per inch), but the container size doesn't dynamically adjust to accommodate panels of varying heights.

**Current behavior:**
- Container: Fixed `minHeight: '400px'`
- Panel rendering: `displayHeight = panelHeight * 4px/inch`
- For 88" panel: `displayHeight = 88 * 4 = 352px`
- For 96" panel: `displayHeight = 96 * 4 = 384px`
- Both fit within 400px, but the `items-end` alignment causes shorter panels to be cut off at the bottom

The issue is the `items-end` alignment (line 304) which aligns items to the bottom of the flex container. When panels are shorter than the container's minimum height, they get positioned at the bottom edge and can overflow or be cut off.

## Files to Modify

1. **Frontend Component**: `src/components/ui/DrawingViewer.tsx`
   - Update elevation view container styling (line 304)
   - Change vertical alignment strategy
   - Ensure panels scale to fit within viewport

## Detailed Changes

### 1. DrawingViewer.tsx - Fix Container Alignment

**Current State (Line 304):**
```tsx
<div key={rowIndex} className="flex items-end justify-center" style={{ minHeight: '400px' }}>
```

**Problem:**
- `items-end` aligns flex items to the bottom of the container
- When panels are shorter than container height, they overflow at bottom
- Fixed `minHeight` doesn't adapt to panel heights

**Changes Required:**

**A. Change Vertical Alignment (Line 304)**

Replace `items-end` with `items-center` to center panels vertically:

```tsx
// Change from:
<div key={rowIndex} className="flex items-end justify-center" style={{ minHeight: '400px' }}>

// To:
<div key={rowIndex} className="flex items-center justify-center" style={{ minHeight: '400px' }}>
```

This ensures panels of any height are centered vertically within the container, preventing bottom cutoff.

**Rationale:**
- `items-center` centers panels vertically in the container
- Panels will always be fully visible regardless of height
- Maintains horizontal centering with `justify-center`
- Preserves the fixed scale of 4 pixels per inch
- Simpler solution that doesn't require dynamic scaling logic

## Testing Steps

### Test Case 1: 88" Tall Panel

**Steps:**
1. Navigate to an opening with an 88" tall panel
2. Open Shop Drawings viewer
3. View Elevation tab

**Expected Result:**
- Panel renders completely visible
- No bottom cutoff
- Panel is centered vertically in container
- Panel maintains correct proportions (4px/inch scale)

### Test Case 2: 96" Tall Panel

**Steps:**
1. Navigate to an opening with a 96" tall panel
2. Open Shop Drawings viewer
3. View Elevation tab

**Expected Result:**
- Panel renders completely visible
- No changes from current behavior
- Panel is centered vertically in container
- Consistent scaling with shorter panels

### Test Case 3: Multiple Panels with Different Heights

**Steps:**
1. Navigate to an opening with panels of varying heights (e.g., 88", 96", 80")
2. Open Shop Drawings viewer
3. View Elevation tab

**Expected Result:**
- All panels render completely visible
- Panels are aligned to bottom baseline (items-center maintains row alignment)
- No cutoff on any panel
- Consistent scaling across all panels

### Test Case 4: Very Short Panels (< 80")

**Steps:**
1. Navigate to an opening with a very short panel (e.g., 60" tall)
2. Open Shop Drawings viewer
3. View Elevation tab

**Expected Result:**
- Panel renders completely visible
- Centered vertically in container
- Appropriate whitespace above and below
- No distortion or cutoff

## Rollback Plan

If issues arise:
1. Revert `DrawingViewer.tsx` change (line 304)
2. Change `items-center` back to `items-end`
3. Document the specific issue encountered
4. Consider alternative solutions (dynamic container height, scrolling, etc.)

## Notes

- This is a simple CSS alignment fix
- No changes to rendering logic or scaling factors
- Maintains backward compatibility with existing panels
- User preference: "Scale all to fit" + "Keep fixed scale" informs this solution
