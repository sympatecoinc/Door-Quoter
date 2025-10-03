# Import/Export Management System
Date: 2025-10-03

## Scope
Files to modify:
- `src/app/api/master-parts/import-with-rules/route.ts` - NEW FILE: Enhanced import for pricing rules format
- `src/components/views/SettingsView.tsx` - Add Export and Import sections
- `src/components/views/MasterPartsView.tsx` - Remove export button

## Requirements Analysis

### Current State
1. **Export**: Button in MasterPartsView exports CSV with pricing rules
2. **Import**:
   - Basic format (template): partNumber, baseName, partType, description, unit, cost, isOption
   - Current upload-csv endpoint only handles basic format
3. **Templates**: Two templates in Settings (Master Parts, Product BOM)

### New Requirements
1. Support import of BOTH formats:
   - **Basic format**: Simple template (current)
   - **Enhanced format**: Exported format with pricing rules
2. Move export from MasterPartsView to Settings
3. Create comprehensive Import/Export management in Settings

## Tasks
- [x] Create new API endpoint `/api/master-parts/import-with-rules`
  - Detect format automatically (basic vs enhanced)
  - Parse stock length rules for extrusions
  - Parse pricing rules for other parts
  - Create MasterPart + associated rules in single transaction
- [x] Remove export button from MasterPartsView
- [x] Add "Export" section to SettingsView with:
  - Export Master Parts (with pricing rules)
  - Export Product BOMs (future placeholder)
- [x] Add "Import" section to SettingsView with:
  - Import Master Parts (auto-detects format)
  - Shows import results (success, errors, skipped)
- [x] "Templates & Downloads" already clarifies basic format
- [x] Add Upload icon to SettingsView imports

## API Design: Enhanced Import

### Input Detection
Check for enhanced format columns:
- stockRule_minHeight, stockRule_maxHeight, etc.
- pricingRule_basePrice, pricingRule_formula

If present → Enhanced format
If not → Basic format (use existing logic)

### Enhanced Format Processing
For each unique partNumber:
1. Create/update MasterPart
2. If has stock rule data: Create StockLengthRule entries
3. If has pricing rule data: Create PricingRule entries

### Transaction Safety
Use Prisma transaction to ensure atomic operations

## Success Criteria
- User can export master parts from Settings (not Master Parts view)
- User can import basic format (template) from Settings
- User can import enhanced format (exported CSV) from Settings
- Import auto-detects format
- Enhanced import creates pricing rules correctly
- Extrusions get stock length rules
- Other parts get pricing rules
- Import shows detailed results (imported, skipped, errors)

## UI Layout - SettingsView

```
Settings
├── General Settings (existing)
├── Quote Settings (existing)
├── Units & Measurements (existing)
├── Templates & Downloads (existing - update description)
├── Export (NEW)
│   ├── Export Master Parts with Pricing Rules
│   └── [Future: Export Product BOMs]
└── Import (NEW)
    ├── Import Master Parts
    ├── File upload
    ├── Format auto-detection
    └── Results display
```

## Changes Made

1. **Created** `src/app/api/master-parts/import-with-rules/route.ts`
   - POST endpoint that auto-detects CSV format (basic vs enhanced)
   - Enhanced format: Groups rows by partNumber, creates master part + rules in transaction
   - Basic format: Creates master parts only (backward compatible)
   - Supports stock length rules for extrusions
   - Supports pricing rules for other parts
   - Returns detailed results: imported count, format detected, errors, skipped items

2. **Modified** `src/components/views/MasterPartsView.tsx`
   - Removed export button from button group
   - Removed handleExport function
   - Removed Download icon from imports

3. **Modified** `src/components/views/SettingsView.tsx`
   - Added Upload and FileUp icons to imports
   - Added state: importFile, importing, importResult
   - Added handleExportMasterParts function (moved from MasterPartsView)
   - Added handleImportMasterParts function
   - Added "Export" section with Export Master Parts button
   - Added "Import" section with:
     - File upload input
     - Import button with loading state
     - Results display showing: imported count, format detected, errors, skipped items
   - Kept "Templates & Downloads" section for basic templates

## Testing Performed
Manual testing required:
1. Run dev server: `npm run dev`
2. Navigate to Settings view
3. **Export test:**
   - Click "Export Master Parts with Pricing Rules"
   - Verify CSV downloads with correct filename
   - Verify CSV contains parts with pricing rules
4. **Import test (basic format):**
   - Download "Master Parts CSV Template"
   - Add test data
   - Import via Settings Import section
   - Verify results display
5. **Import test (enhanced format):**
   - Use exported CSV from step 3
   - Import via Settings Import section
   - Verify pricing rules are created
   - Verify results show "enhanced" format detected

## Notes
- Enhanced import is backward compatible (supports basic format)
- Export moved to Settings for better organization
- Import/Export are now centralized in Settings
- Pricing rules are preserved through export/import cycle
