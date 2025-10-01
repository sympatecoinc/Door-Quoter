# Name: Shop Drawings Product Views
# Date: 10-01-25

## Scope
Files to modify:
- src/components/ui/DrawingViewer.tsx: Modify to fetch and display product elevation/plan views instead of generating drawings
- src/app/api/drawings/elevation/[openingId]/route.ts: Update to return product elevation images
- src/app/api/drawings/plan/[openingId]/route.ts: Update to return product plan view images

## Tasks
- [x] Task 1: Update elevation API route to fetch product elevation images from database instead of generating
- [x] Task 2: Update plan API route to fetch product plan view images from database instead of generating
- [x] Task 3: Update DrawingViewer component to handle product-based images (may need to show multiple plan views)
- [x] Task 4: Test the shop-drawings button displays correct product elevation and plan views

## Success Criteria
- When clicking "Shop Drawings" button on an opening, elevation view shows the product's uploaded elevation image
- Plan view shows the product's uploaded plan view images
- Multiple plan views (for different swing directions) are accessible if available
- No Python drawing generation is triggered for openings with product images
