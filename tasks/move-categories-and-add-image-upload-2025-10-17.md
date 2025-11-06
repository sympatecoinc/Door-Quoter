# Move Categories Tab and Add Image Upload
Date: 2025-10-17

## Scope
Files to modify:
- src/components/views/ProductsView.tsx - Remove Categories tab
- src/components/views/MasterPartsView.tsx - Add Categories tab
- src/components/views/CategoryDetailView.tsx - May need minor adjustments for new location
- prisma/schema.prisma - Add image field to MasterPart model
- src/app/api/master-parts/[id]/route.ts - Update to handle image upload
- src/app/api/master-parts/route.ts - Update to handle image upload

Files to create:
- src/app/api/master-parts/[id]/upload-image/route.ts - Image upload API endpoint
- public/uploads/master-parts/ - Directory for storing master part images

## Tasks
- [ ] Task 1: Update database schema to add image fields to MasterPart model
- [ ] Task 2: Remove Categories and Options tabs from ProductsView
- [ ] Task 3: Add Categories tab to MasterPartsView with full category management
- [ ] Task 4: Add image upload field to MasterPart form for Hardware parts marked as category options
- [ ] Task 5: Create image upload API route for master parts
- [ ] Task 6: Update CategoryDetailView to display master part images in options list
- [ ] Task 7: Run database migration to add image field
- [ ] Task 8: Test complete functionality

## Success Criteria
- Categories tab no longer appears in Products view
- Categories tab appears in Master Parts view with all existing functionality
- Hardware parts marked as "Available as Category Option" can have images uploaded
- Images are displayed in the CategoryDetailView when viewing options
- Images are stored in public/uploads/master-parts/ directory
- Database migration runs successfully

## Implementation Details

### 1. Database Schema Changes
Add to MasterPart model in schema.prisma:
```prisma
model MasterPart {
  // ... existing fields
  optionImagePath String? // Path to uploaded image for category options
  optionImageOriginalName String? // Original filename
}
```

### 2. Categories Tab Location
**Current:** ProductsView (lines 234-277)
- Tabs array includes categories (line 236)
- CategoriesTab component rendered (lines 319-332)
- Full category CRUD functionality

**Target:** MasterPartsView
- Add categories as 4th tab after 'glass' tab
- Reuse existing CategoriesTab component from ProductsView
- Extract CategoriesTab and OptionsTab into separate files for reusability

### 3. Image Upload Feature
**Location:** MasterPartsView Hardware part form (lines 1397-1443)
- Add conditional image upload field when isOption checkbox is checked
- Only show for Hardware parts (partType === 'Hardware')
- Support common image formats (PNG, JPG, JPEG)
- Preview uploaded image
- Store in public/uploads/master-parts/{partId}/

### 4. Component Structure
```
MasterPartsView
├── Master Parts Tab (existing)
├── Part Rules Tab (existing)
├── Glass Tab (existing)
└── Categories Tab (NEW - moved from ProductsView)
    ├── CategoriesTab component
    └── OptionsTab component
```

### 5. Image Storage
- Directory: public/uploads/master-parts/{partId}/
- Filename format: {timestamp}-{originalname}
- Store relative path in database
- Show image in CategoryDetailView option cards

## Changes Made
(To be updated during execution)

## Testing Performed
(To be updated after completion)

## Notes
- The Categories functionality is closely tied to Master Parts (Hardware type specifically)
- Moving it to Master Parts view makes logical sense as users configure hardware master parts and then assign them to categories
- Image upload only applies to Hardware parts marked as "Available as Category Option"
- Existing Category and Option APIs remain unchanged
- No breaking changes to existing functionality
