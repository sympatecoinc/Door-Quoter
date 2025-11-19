# Extrusion Finish Pricing Feature
Date: 2025-11-19

## Scope
Files to modify:
- `prisma/schema.prisma`: Add finishColor to Opening model, create ExtrusionFinishPricing settings model
- `src/app/api/settings/extrusion-finish-pricing/route.ts`: New API for managing finish pricing settings
- `src/components/views/SettingsView.tsx`: Add UI for configuring extrusion finish costs
- `src/app/api/openings/[id]/calculate-price/route.ts`: Update pricing calculation to include finish costs
- `src/components/views/ProjectDetailView.tsx`: Add finish selection when creating/editing openings
- `src/app/api/openings/route.ts`: Handle finishColor when creating openings
- `src/app/api/openings/[id]/route.ts`: Handle finishColor when updating openings
- `src/types/index.ts`: Add finish-related types

## Tasks
- [x] Analyze codebase to understand current extrusion pricing and finish handling
- [x] Create comprehensive implementation plan
- [x] Update database schema for finish pricing
- [x] Create database migration
- [x] Add settings API endpoints for finish pricing
- [x] Update SettingsView with finish pricing configuration UI
- [x] Update types/index.ts with finish-related types
- [x] Update opening creation API to handle finishColor
- [x] Update opening update API to handle finishColor
- [x] Update pricing calculation to include finish costs
- [x] Update ProjectDetailView to include finish selection UI
- [x] Test finish pricing functionality

## Success Criteria
- Users can configure per-foot costs for Powder Coated and Anodized finishes in Settings
- Users can select a finish when creating an opening
- Extrusion costs are automatically adjusted based on finish selection and cut length
- Finish costs are properly displayed in price breakdowns
- All extrusions in an opening use the same finish

## Implementation Details

### 1. Database Schema Changes
Add `finishColor` field to Opening model and create ExtrusionFinishPricing settings table:
- Opening.finishColor: String field for finish type (e.g., "Mill Finish", "Powder Coated", "Anodized")
- ExtrusionFinishPricing model: Global settings table with finish types and cost per foot

### 2. Finish Pricing Logic
When calculating extrusion costs:
1. Get the base extrusion cost from stock length rules (existing logic)
2. For each extrusion in the BOM:
   - Get the cut length from the ProductBOM formula
   - Convert to feet (divide by 12)
   - Look up finish cost per foot from settings
   - Calculate: `finish_cost = (cut_length_in_feet * cost_per_foot * quantity)`
3. Add finish cost to the extrusion's total cost

### 3. Settings Configuration
Add section in SettingsView for "Extrusion Finish Pricing":
- Table showing finish types with editable cost per foot
- Default finishes: Mill Finish ($0.00), Powder Coated, Anodized
- Allow adding custom finish types

### 4. UI Updates
Restore finish selection in ProjectDetailView:
- Add finish dropdown to "Add Opening" modal
- Display finish badge on each opening card
- Default to "Mill Finish" (no additional cost)

## Changes Made

### Database Changes
1. Added `finishColor` field to `Opening` model (String?, nullable)
2. Created new `ExtrusionFinishPricing` model with:
   - finishType (String, unique)
   - costPerFoot (Float, default 0)
   - isActive (Boolean, default true)
3. Created migration: `20251119200253_add_extrusion_finish_pricing`
4. Seeded default finish types: "Powder Coated" ($2.50/ft), "Anodized" ($1.75/ft)

### API Changes
1. Created `/api/settings/extrusion-finish-pricing`:
   - GET: List all finish pricing settings
   - POST: Create new finish type
2. Created `/api/settings/extrusion-finish-pricing/[id]`:
   - PUT: Update finish pricing
   - DELETE: Delete finish type
3. Updated `/api/openings` POST to accept `finishColor` parameter
4. Updated `/api/openings/[id]` PUT to accept `finishColor` parameter
5. Updated `/api/openings/[id]/calculate-price`:
   - Modified `calculateBOMItemPrice` to accept `finishColor` parameter
   - Added finish cost calculation for extrusions based on cut length
   - Finish cost formula: `(cutLengthInches / 12) * costPerFoot * quantity`
   - Added `finishCost` and `finishDetails` to breakdown object

### UI Changes
1. **SettingsView**: Added "Extrusion Finish Pricing" section with:
   - Table showing all finish types with editable costs
   - Inline edit functionality
   - Add/Delete finish type buttons
   - Loading state during API calls
2. **ProjectDetailView**:
   - Added finish type dropdown to "Add Opening" modal
   - Displays cost per foot next to each finish option
   - Defaults to "Mill Finish" (no additional cost)
   - Added helper text explaining finish applies to all extrusions
   - Loads finish types from API on component mount
3. **Opening display**: Finish color badge already present in UI, now functional

### Type Changes
1. Updated `Opening` interface in `src/types/index.ts` to include `finishColor?: string | null`

## Testing Performed

### Setup
1. Created and ran database migration successfully
2. Seeded test finish types:
   - Powder Coated: $2.50/ft
   - Anodized: $1.75/ft
3. Development server running on http://localhost:3001

### Testing Steps
1. **Settings Configuration**: Users can navigate to Settings and see the new "Extrusion Finish Pricing" section with the seeded finish types
2. **Opening Creation**: When creating a new opening, users can select from:
   - Mill Finish (default, $0.00/ft)
   - Powder Coated (+$2.50/ft)
   - Anodized (+$1.75/ft)
3. **Price Calculation**: When an opening has components with extrusions:
   - Base extrusion cost is calculated as before
   - Finish cost is added based on: (cut_length / 12) × cost_per_foot × quantity
   - Total cost includes both base and finish costs
   - Breakdown shows finish details separately

### Integration Points Verified
- Database schema updated and migrated
- API endpoints functional
- UI components rendering correctly
- Pricing calculation includes finish costs
- Finish selection persists on opening

## Notes
- Finish is stored at Opening level, affecting all extrusions in that opening
- Cut length calculation uses existing ProductBOM formula evaluation
- Finish cost is separate from base extrusion cost for transparency in breakdowns
