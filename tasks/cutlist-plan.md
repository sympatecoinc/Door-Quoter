## Implementation Plan

### Approach
Extend the existing `/api/projects/[id]/bom` endpoint with a `?cutlist=true` query parameter instead of creating a new endpoint. This reuses the existing BOM generation logic (600+ lines) and avoids code duplication. The cut list will filter to extrusions only and group by product type + size.

### Efficiency Notes
- [x] No code duplication - extends existing BOM endpoint
- [x] Reuses existing logic from: `src/app/api/projects/[id]/bom/route.ts`
- [x] Backward compatible: existing API unchanged
- [x] ~150 lines new code (vs ~400+ if duplicating BOM logic)

### Files to Modify
1. **Frontend**: `src/components/views/ProjectDetailModal.tsx` (MODIFY)
   - Add "Production" tab to tab list
   - Add cut list state and fetch logic
   - Add cut list display with table grouped by product type + size
   - Add CSV download, print, and stock optimization features

2. **Backend API**: `src/app/api/projects/[id]/bom/route.ts` (MODIFY)
   - Add `?cutlist=true` query parameter handling
   - Add `cutlistToCSV()` helper function
   - Add cut list grouping logic by product type + size
   - Add stock optimization calculations

---

## Detailed Changes

### 1. Backend API Changes (`src/app/api/projects/[id]/bom/route.ts`)

**Current State:**
- Supports `?summary=true` for purchasing summary
- Supports `?format=csv` for CSV export
- Generates full BOM with extrusions, hardware, glass, options

**Changes Required:**

**A. Add Cut List Aggregation Function (After line ~162)**

Add helper function to aggregate extrusions for cut list by product type + size, filtering to extrusions only and grouping by product name + panel dimensions.

**B. Add Cut List CSV Function (After aggregateCutListItems)**

Add helper function to convert cut list to CSV format with columns: Product, Size (WxH), Part Number, Part Name, Stock Length, Cut Length, Qty Per Unit, Unit Count, Total Qty.

**C. Add Query Parameter Handling (Around line ~203)**

Add `cutlist` query parameter parsing alongside existing `summary` and `format` params.

**D. Add Cut List Response Logic (After summary handling, around line ~640)**

Add logic to return cut list data with stock optimization calculations when `?cutlist=true` is requested.

---

### 2. Frontend Changes (`src/components/views/ProjectDetailModal.tsx`)

**Current State:**
- Has 5 tabs: overview, contacts, notes, shipping, purchasing
- TabType union type defines allowed tabs
- Uses similar pattern for shipping/purchasing data fetching

**Changes Required:**

**A. Update TabType (Line ~58)**
Add 'production' to TabType union.

**B. Add Lucide Icon Import (Line ~4)**
Add Factory and Printer icons.

**C. Add Cut List Interfaces (After SummaryData interface, line ~82)**
Add CutListItem, StockOptimization, and CutListData interfaces.

**D. Add Cut List State (After purchasing state, around line ~108)**
Add cutListData and loadingCutList state variables.

**E. Add Data Fetch Effect (In useEffect around line ~121)**
Fetch cut list when production tab is active.

**F. Add fetchCutList Function (After fetchPurchasingSummary)**
Fetch cut list data from API.

**G. Add CSV Download Handler**
Open CSV download URL in new window.

**H. Add Print Handler**
Trigger browser print dialog.

**I. Add Production Tab Button (After purchasing tab button, around line ~459)**
Add Production tab with Factory icon.

**J. Add Production Tab Content (After purchasing tab content, around line ~945)**
Add cut list display with:
- Header with Download/Print buttons
- Total parts stat card
- Stock optimization section
- Cut list table with all columns

---

## Testing Steps

### Test Case 1: Production Tab Navigation
- Open project with openings/components
- Click on "Production" tab
- Verify tab becomes active and data loads

### Test Case 2: Cut List Data Display
- Navigate to Production tab
- Verify table shows extrusion parts only
- Verify grouping by product type + size

### Test Case 3: CSV Download
- Navigate to Production tab
- Click "Download CSV" button
- Verify file downloads with correct data

### Test Case 4: Print Functionality
- Navigate to Production tab
- Click "Print" button
- Verify print preview shows table

### Test Case 5: Stock Optimization Display
- Navigate to Production tab for project with extrusions
- Verify stock optimization section shows cuts per stock and waste

---

## Rollback Plan

If issues arise:
1. Revert changes to `ProjectDetailModal.tsx`
2. Revert changes to `bom/route.ts`
3. Redeploy previous version
4. Document issues
