# Glass Pricing Management
Date: 2025-10-03

## Scope
Add glass pricing management to Master Parts with a new Glass tab. Glass types will be stored in the database with their cost per sqft and will populate dropdowns when adding components to openings.

Files to modify:
- `prisma/schema.prisma`: Add GlassType model
- `src/app/api/glass-types/route.ts`: Create API for listing and creating glass types (NEW FILE)
- `src/app/api/glass-types/[id]/route.ts`: Create API for updating and deleting glass types (NEW FILE)
- `src/components/views/MasterPartsView.tsx`: Add Glass tab with CRUD interface
- `src/components/views/ProjectDetailView.tsx`: Update to fetch glass types from database

## Tasks
- [x] Task 1: Update Prisma schema to add GlassType model
- [x] Task 2: Run database migration to create GlassType table
- [x] Task 3: Create API route `/api/glass-types` for GET (list) and POST (create)
- [x] Task 4: Create API route `/api/glass-types/[id]` for GET, PUT, DELETE operations
- [x] Task 5: Add "Glass" tab to MasterPartsView component with activeTab state
- [x] Task 6: Create glass type management UI (list, add, edit, delete forms)
- [x] Task 7: Update ProjectDetailView to fetch glass types from API instead of hardcoded values
- [x] Task 8: Integrate glass pricing into opening price calculation
- [ ] Task 9: Test creating, editing, and deleting glass types
- [ ] Task 10: Test glass type selection and pricing in component creation

## Success Criteria
- ✓ GlassType table exists in database with fields: id, name, description, pricePerSqFt, createdAt, updatedAt
- ✓ Users can view all glass types in Master Parts > Glass tab
- ✓ Users can create new glass types with name and price per sqft
- ✓ Users can edit existing glass types
- ✓ Users can delete glass types (with confirmation)
- ✓ Glass type dropdown in ProjectDetailView populates from database
- ✓ Glass types maintain price per sqft for future cost calculations

## Database Schema
```prisma
model GlassType {
  id           Int      @id @default(autoincrement())
  name         String   @unique
  description  String?
  pricePerSqFt Float
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("GlassTypes")
}
```

## API Endpoints
- `GET /api/glass-types` - List all glass types
- `POST /api/glass-types` - Create new glass type
- `GET /api/glass-types/[id]` - Get single glass type
- `PUT /api/glass-types/[id]` - Update glass type
- `DELETE /api/glass-types/[id]` - Delete glass type

## UI Components
1. **Master Parts View - Glass Tab**
   - Table showing: Name, Description, Price per SqFt, Actions
   - "Add Glass Type" button
   - Edit/Delete buttons for each row
   - Modal form for add/edit with fields:
     - Name (required)
     - Description (optional)
     - Price per SqFt (required, number)

2. **Project Detail View - Component Form**
   - Glass Type dropdown populated from database
   - Replaces hardcoded "Clear" option

## Changes Made

### Database Schema
- Added `GlassType` model to `prisma/schema.prisma`
- Fields: id, name (unique), description (optional), pricePerSqFt, createdAt, updatedAt
- Pushed schema changes to database using `prisma db push`

### API Routes
- Created `src/app/api/glass-types/route.ts`:
  - GET: Returns all glass types sorted by name
  - POST: Creates new glass type with validation (name required, pricePerSqFt required, name uniqueness check)
- Created `src/app/api/glass-types/[id]/route.ts`:
  - GET: Returns single glass type by ID
  - PUT: Updates glass type with validation (same as POST)
  - DELETE: Deletes glass type by ID

### UI Components
- Modified `src/components/views/MasterPartsView.tsx`:
  - Added `GlassType` interface
  - Updated `activeTab` type to include 'glass'
  - Added glass types state management (glassTypes, loadingGlass, showAddGlassForm, etc.)
  - Added glass type CRUD functions (fetchGlassTypes, handleCreateGlassType, handleUpdateGlassType, handleDeleteGlassType)
  - Added "Glass" tab to navigation bar with Sparkles icon
  - Created Glass tab content with table showing name, description, price per sqft, and actions
  - Created Add/Edit Glass Type modal form
  - Added useEffect to fetch glass types when glass tab is opened

- Modified `src/components/views/ProjectDetailView.tsx`:
  - Added `glassTypes` state variable
  - Added `fetchGlassTypes` function
  - Added useEffect to fetch glass types on component mount
  - Updated glass type dropdown to populate from database instead of hardcoded values
  - Shows price per sqft in dropdown options

### Price Calculation Integration
- Modified `src/app/api/openings/[id]/calculate-price/route.ts`:
  - Added `glassCost` and `totalGlassCost` to component breakdown
  - Added glass cost calculation after BOM and option costs
  - Fetches glass type from database by name
  - Uses product's glass formulas (glassWidthFormula, glassHeightFormula, glassQuantityFormula)
  - Calculates square footage: (width * height / 144) * quantity
  - Calculates glass cost: sqft * pricePerSqFt
  - Includes detailed breakdown: glass type, dimensions, sqft, price per sqft, total cost
  - Adds glass cost to total component cost

## Testing Performed

### Manual Testing Required
The development server is running on http://localhost:3001. To complete testing:

1. **Navigate to Master Parts > Glass tab**
   - Verify Glass tab appears in navigation
   - Verify empty state shows when no glass types exist

2. **Create Glass Types**
   - Click "Add Glass Type"
   - Create test entries:
     - Clear Glass: $2.50/sqft
     - Frosted Glass: $3.75/sqft
     - Tempered Glass: $5.00/sqft
   - Verify validation works (name and price required)
   - Verify duplicate names are rejected

3. **Edit Glass Types**
   - Click edit icon on a glass type
   - Modify name, description, or price
   - Verify changes save correctly
   - Verify name uniqueness validation works

4. **Delete Glass Types**
   - Click delete icon
   - Verify confirmation dialog appears
   - Verify deletion works

5. **Test in Project Detail View**
   - Open a project
   - Add a component to an opening
   - Verify glass type dropdown shows database entries
   - Verify prices show in dropdown
   - Create a component with a glass type selection

## Notes
- Glass types are NOT master parts (they're not stocked items)
- The existing prevention of creating "Glass" as a master part (line 109-113 in master-parts/route.ts) should remain
- Glass pricing is per square foot, not per piece like hardware
- Future enhancement: Link glass type selection in Panel to actual cost calculations
