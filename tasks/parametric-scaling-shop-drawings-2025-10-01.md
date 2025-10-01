# Parametric Scaling Shop Drawings
Date: 2025-10-01

## Scope
Files to modify:
- src/app/api/drawings/elevation/[openingId]/route.ts: Include panel width/height dimensions
- src/app/api/drawings/plan/[openingId]/route.ts: Include panel width/height dimensions
- src/components/ui/DrawingViewer.tsx: Apply parametric SVG scaling based on panel dimensions

## Tasks
- [x] Task 1: Update elevation API to include panel width and height for each elevation image
- [x] Task 2: Update plan API to include panel width and height for each plan view
- [x] Task 3: Import and use processParametricSVG in DrawingViewer for elevation images
- [x] Task 4: Import and use processParametricSVG in DrawingViewer for plan view images
- [x] Task 5: Handle both SVG and raster image formats (apply scaling only to SVGs)

## Success Criteria
- 36" wide panel displays wider than 24" panel in shop drawings
- Horizontal elements (rails) scale width only - height stays constant
- Vertical elements (stiles) scale height only - width stays constant
- Glass areas scale both width and height proportionally
- Plan view images scale based on panel dimensions
- Elevation view images scale based on panel dimensions
- Raster images (PNG/JPG) display at original size or with CSS scaling

## Changes Made
- src/app/api/drawings/elevation/[openingId]/route.ts:32-51 - Added width/height to elevation images response
- src/app/api/drawings/plan/[openingId]/route.ts:40-71 - Added width/height to plan views response
- src/components/ui/DrawingViewer.tsx:5 - Imported processParametricSVG and svgToDataUrl
- src/components/ui/DrawingViewer.tsx:10-24 - Updated DrawingData interface to include width/height
- src/components/ui/DrawingViewer.tsx:96-167 - Added processImage helper function that:
  * Checks filename extension to detect SVG files
  * Only applies parametric scaling to .svg files
  * Handles base64 decoding of SVG data
  * Logs detailed debug information to console
  * Falls back to original image if processing fails
- src/components/ui/DrawingViewer.tsx:312 - Applied processImage to elevation images with fileName
- src/components/ui/DrawingViewer.tsx:397 - Applied processImage to plan view images with fileName

## Testing Performed
- Manual testing required: Upload SVG with properly named elements (horizontal/vertical/rail/stile)
- Create panels with different widths (e.g., 24" and 36")
- View shop drawings and verify wider panel displays proportionally wider
- Verify horizontal rails only scale width, vertical stiles only scale height

## Notes
- Parametric SVG system already exists in src/lib/parametric-svg.ts
- SVG elements must have proper naming: "horizontal"/"rail" for rails, "vertical"/"stile" for stiles
- System follows SHOPGEN pattern recognition
