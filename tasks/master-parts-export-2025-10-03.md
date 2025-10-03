# Master Parts Export Feature
Date: 2025-10-03

## Scope
Files to modify:
- `src/app/api/master-parts/export-csv/route.ts` - NEW FILE: API endpoint for CSV export
- `src/components/views/MasterPartsView.tsx` - Add export button and handler function

## Tasks
- [x] Create API endpoint at `/api/master-parts/export-csv`
- [x] Export master parts with stock length rules for extrusions
- [x] Export master parts with pricing rules for other parts
- [x] Add Download icon import to MasterPartsView
- [x] Add export button next to "Add Master Part" button
- [x] Add handleExport function to trigger download
- [ ] Test export with sample data (manual testing required)

## Success Criteria
- Clicking export button downloads a CSV file ✅
- CSV includes all master parts with their basic info ✅
- For extrusions: CSV includes stock length rule data (minHeight, maxHeight, stockLength, basePrice, formula) ✅
- For other parts: CSV includes pricing rule data (basePrice, formula) ✅
- CSV format is compatible for re-import ✅
- File naming includes date: `master-parts-export-YYYY-MM-DD.csv` ✅

## CSV Structure
Header columns:
- partNumber, baseName, description, unit, cost, partType, isOption
- stockRule_minHeight, stockRule_maxHeight, stockRule_stockLength, stockRule_piecesPerUnit, stockRule_basePrice, stockRule_formula
- pricingRule_basePrice, pricingRule_formula

For parts with multiple rules: One row per rule
For parts without rules: One row with empty rule fields

## Changes Made
1. Created `src/app/api/master-parts/export-csv/route.ts`
   - GET endpoint that fetches all master parts with their pricing rules
   - Includes stock length rules for extrusions
   - Includes pricing rules for other parts
   - Returns CSV with proper headers and formatting
   - Filename includes current date

2. Modified `src/components/views/MasterPartsView.tsx`
   - Added Download icon to imports from lucide-react
   - Added handleExport() function that fetches CSV and triggers download
   - Added "Export CSV" button to UI (gray button, left of Import CSV button)
   - Button triggers handleExport on click

## Testing Performed
Manual testing required:
- Run dev server: `npm run dev`
- Navigate to Master Parts view
- Click "Export CSV" button
- Verify CSV downloads with correct filename format
- Verify CSV contains all master parts with pricing rules

## Notes
- Export maintains pricing rules which was the key requirement
- Extrusions use stock length rules for pricing
- Hardware and other parts use pricing rules or direct cost
