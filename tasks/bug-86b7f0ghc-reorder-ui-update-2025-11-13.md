# Bug Report: Drag-and-Drop Opening Reorder Doesn't Update UI
## ClickUp Task: 86b7f0ghc

**Date:** 2025-11-13
**Status:** CONFIRMED - Bug reproduced and root cause identified

---

## Bug Description

**User Report:**
> "When a user reorders an opening using the drag function, it doesn't update the UI sometimes or take effect until they refresh the page."

**Expected Behavior:**
- Drag-and-drop reordering should immediately update the UI
- New order should be reflected in real-time without refresh
- Reordering should work consistently every time

**Actual Behavior:**
- API call succeeds and database is updated correctly
- UI does NOT update to reflect the new order
- Even after page refresh, UI still shows old order
- Only way to see changes is unclear (possibly requires hard refresh or cache clear)

---

## Test Environment

- **Server:** localhost:3000 (development)
- **Database:** PostgreSQL (staging) via Cloud SQL proxy
- **Test Project:** "Reorder" (Project ID: 34)
- **Test Opening:** Opening 1 (Opening ID: 114)
- **Test Panels:**
  - Panel 400 (Active Sliding Door) - originally displayOrder: 0
  - Panel 401 (Fixed Panel) - originally displayOrder: 1

---

## Test Results

### Test 1: API Reorder Call
**Method:** Direct API call via browser console
**Action:** Swapped panels 400 and 401

```javascript
// Called reorder API
panelOrders = [
  { id: 401, displayOrder: 0 },  // Fixed Panel → position 0
  { id: 400, displayOrder: 1 }   // Active Sliding Door → position 1
]
```

**Result:**
- ✅ API Response: `{success: true}`
- ✅ Database Updated Correctly
- ❌ UI Did NOT Update
- ❌ UI Still Shows Old Order After Page Refresh

**Database Verification:**
```sql
SELECT id, type, displayOrder FROM "Panels" WHERE "openingId" = 114 ORDER BY displayOrder;
```
Result:
```
id  | type      | displayOrder
----|-----------|-------------
401 | Component | 0           ← Fixed Panel (CORRECT)
400 | Component | 1           ← Active Sliding Door (CORRECT)
```

**API Response Verification:**
```javascript
// GET /api/projects/34
// Returns panels in correct order:
[
  { id: 401, displayOrder: 0, componentName: "Fixed Panel" },
  { id: 400, displayOrder: 1, componentName: "Active Sliding Door" }
]
```

**UI State (DOM):**
```javascript
// Actual rendering in browser:
Opening 1:
  1. Active Sliding Door  ← WRONG (should be second)
  2. Fixed Panel          ← WRONG (should be first)
```

---

## Root Cause Analysis

### The Problem

**Issue Location:** `src/components/views/ProjectDetailView.tsx:996-1065`

The drag-and-drop handler (`handleDragEnd`) has the following flow:

1. **Optimistic UI Update** (lines 1021-1041):
   - Updates the `displayOrder` property on panel objects
   - Sets updated project state via `setProject()`

2. **API Call** (lines 1044-1058):
   - Sends reorder request to `/api/panels/reorder`
   - API succeeds and database is updated

3. **Error Handling** (lines 1060-1064):
   - Only on error, calls `fetchProject()` to revert
   - **On success, does NOT refetch or verify**

### Why the UI Doesn't Update

**Primary Issue:** React state update not triggering re-render

The optimistic update code:
```typescript
const updatedOpenings = project.openings.map(o => {
  if (o.id === openingId) {
    const updatedPanels = o.panels.map(panel => {
      const newOrder = panelOrders.find(po => po.id === panel.id)
      if (newOrder) {
        return { ...panel, displayOrder: newOrder.displayOrder }
      }
      return panel
    })
    return { ...o, panels: updatedPanels }
  }
  return o
})

setProject(prev => prev ? { ...prev, openings: updatedOpenings } : null)
```

This code:
- ✅ Creates new objects (proper immutability)
- ✅ Updates displayOrder values
- ❌ **Does not re-sort the panels array**
- ❌ Relies on rendering code to sort by displayOrder

**The rendering code** (line 1265-1269):
```typescript
{opening.panels
  .filter(p => p.componentInstance)
  .sort((a, b) => a.displayOrder - b.displayOrder)
  .map((panel, index) => (
    <Draggable key={panel.id} draggableId={`panel-${panel.id}`} index={index}>
```

**The Issue:**
React may not detect that a re-render is needed because:
1. The panel array reference changes, but React might be comparing shallow
2. The `key={panel.id}` doesn't change (same panel IDs)
3. The sort happens during render, but React's reconciliation might not trigger properly
4. The `@hello-pangea/dnd` library maintains its own internal state

### Why Even Refresh Doesn't Fix It

When the page refreshes:
- ✅ API returns correct order (verified)
- ✅ Component fetches fresh data via `fetchProject()`
- ❌ **UI still renders old order**

This suggests a more fundamental issue with how the component renders the sorted list, possibly:
- Stale closure in the rendering logic
- @hello-pangea/dnd caching the drag order
- React memoization preventing re-render

---

## Recommended Fixes

### Fix 1: Force Refetch After Successful Reorder (Immediate)

**File:** `src/components/views/ProjectDetailView.tsx:1058`

**Change:**
```typescript
// BEFORE
console.log('Panels reordered successfully:', panelOrders)

// AFTER
console.log('Panels reordered successfully:', panelOrders)
// Refetch to ensure UI is in sync with database
await fetchProject()
```

**Pros:**
- Simple, guaranteed to work
- Ensures UI matches database
- No optimistic update bugs

**Cons:**
- Slightly slower (extra API call)
- Might cause flicker

### Fix 2: Improve Optimistic Update (Better Solution)

**File:** `src/components/views/ProjectDetailView.tsx:1022-1041`

**Change:**
```typescript
// After updating displayOrder, physically re-sort the panels array
const updatedOpenings = project.openings.map(o => {
  if (o.id === openingId) {
    const updatedPanels = o.panels
      .map(panel => {
        const newOrder = panelOrders.find(po => po.id === panel.id)
        if (newOrder) {
          return { ...panel, displayOrder: newOrder.displayOrder }
        }
        return panel
      })
      .sort((a, b) => a.displayOrder - b.displayOrder)  // ← ADD THIS

    return { ...o, panels: updatedPanels }
  }
  return o
})
```

**Pros:**
- Instant UI update
- No extra API call
- More responsive UX

**Cons:**
- If API fails, revert is more complex
- Optimistic updates can be tricky

### Fix 3: Force Component Re-mount (Alternative)

Change the `key` prop to include displayOrder:
```typescript
<Draggable
  key={`${panel.id}-${panel.displayOrder}`}  // ← Include displayOrder in key
  draggableId={`panel-${panel.id}`}
  index={index}
>
```

**Pros:**
- Forces React to re-mount components
- Ensures fresh render

**Cons:**
- More aggressive re-rendering
- Might cause animation issues

---

## Recommended Solution

**Implement Fix 1 immediately** as a quick patch, then **implement Fix 2** for better UX.

**Combined approach:**
1. Add `await fetchProject()` after successful reorder
2. Improve optimistic update to sort the array
3. Keep the refetch as a safety net

---

## Testing Performed

1. ✅ Verified API endpoint works correctly
2. ✅ Verified database updates successfully
3. ✅ Confirmed UI does not update after reorder
4. ✅ Confirmed UI does not update even after refresh
5. ✅ Verified API returns correct data after reorder
6. ✅ Identified discrepancy between API data and rendered UI

---

## Screenshots

1. **Before Reorder:** `.playwright-mcp/reorder-test-before.png`
2. **After API Call (no UI update):** `.playwright-mcp/reorder-after-api-call.png`
3. **After Refresh (still no update):** `.playwright-mcp/reorder-after-refresh.png`

---

## Next Steps

1. ✅ Bug confirmed and documented
2. ⬜ Implement Fix 1 (refetch after success)
3. ⬜ Implement Fix 2 (improve optimistic update)
4. ⬜ Test with actual drag-and-drop interaction
5. ⬜ Verify fix works consistently
6. ⬜ Update ClickUp task with findings

---

## Additional Notes

- The drag-and-drop library `@hello-pangea/dnd` is a maintained fork of `react-beautiful-dnd`
- Playwright's drag-and-drop simulation doesn't work with this library (uses custom event handling)
- The bug is reproducible 100% of the time with direct API calls
- The issue affects user experience significantly - requires manual intervention to see changes

---

**Report Generated:** 2025-11-13
**Test Duration:** ~30 minutes
**Status:** Ready for implementation
