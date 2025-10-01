# Server-Side SVG to PNG Rendering - Fix SVG Scaling Issue

Date: 2025-10-01

## Problem Statement
SVG viewBox transformation applies uniformly to all elements in the browser, making it impossible to maintain constant stile widths when door dimensions change. The current client-side parametric scaling approach cannot overcome this fundamental browser limitation.

## Solution: Server-Side SVG to PNG Conversion (SHOPGEN Approach)
Convert SVG to PNG on the server using the same approach as SHOPGEN (Python's cairosvg). This bypasses browser viewBox limitations by rendering the SVG with parametric transformations applied, then returning a rasterized PNG.

## Technology Choice: resvg-js

**Selected Library:** `@resvg/resvg-js`

**Justification:**
- **Performance:** Fastest option (12 ops/s vs Sharp's 9 ops/s)
- **Rust-based:** Native performance with Rust backend via napi-rs
- **Zero dependencies:** No node-gyp or postinstall required
- **Cross-platform:** Pre-compiled .node files for all platforms including Apple M chips
- **Feature-rich:** Supports system fonts, custom fonts, background colors, cropping, scaling
- **Actively maintained:** Modern library designed for 2025+ use cases

**Alternatives Considered:**
- Sharp: Good but slower, limitations with base64-encoded SVGs
- node-svg2img: Uses resvg-js under the hood (wrapper), prefer direct usage
- Puppeteer/headless browsers: Too heavy, slow, and resource-intensive

## Scope

### Files to Modify:
1. `package.json` - Add resvg-js dependency
2. `src/app/api/drawings/elevation/[openingId]/route.ts` - Add SVG to PNG conversion
3. `src/app/api/drawings/plan/[openingId]/route.ts` - Add SVG to PNG conversion
4. `src/lib/parametric-svg.ts` - Move to server-side utility (or keep for server use only)
5. `src/components/ui/DrawingViewer.tsx` - Remove client-side SVG processing

### New Files to Create:
1. `src/lib/svg-renderer.ts` - Server-side SVG to PNG rendering utility

## Architecture

### Current Flow (Client-Side, Broken):
```
API Endpoint → Returns SVG base64
    ↓
Browser receives SVG
    ↓
DrawingViewer.processImage() applies parametric scaling
    ↓
Browser renders with viewBox (BREAKS: uniform scaling applied)
```

### New Flow (Server-Side, Fixed):
```
API Endpoint → Receives panel dimensions
    ↓
Apply parametric SVG scaling (processParametricSVG)
    ↓
Render SVG to PNG using resvg-js
    ↓
Return PNG base64 to browser
    ↓
Browser displays PNG (NO viewBox issues)
```

## Tasks

### Phase 1: Setup
- [x] Research SVG to PNG libraries
- [x] Create planning document
- [ ] Install resvg-js: `npm install @resvg/resvg-js`
- [ ] Create `src/lib/svg-renderer.ts` utility

### Phase 2: Server-Side Rendering
- [ ] Implement `renderSvgToPng()` function in svg-renderer.ts
  - Accept SVG string and dimensions
  - Use resvg-js to render to PNG buffer
  - Convert to base64
  - Return PNG data
- [ ] Update elevation API endpoint to process SVG → PNG server-side
- [ ] Update plan API endpoint to process SVG → PNG server-side

### Phase 3: Client-Side Cleanup
- [ ] Remove `processImage()` function from DrawingViewer.tsx
- [ ] Remove parametric-svg.ts imports from DrawingViewer
- [ ] Simplify image display (just show PNG data directly)
- [ ] Remove SVG-specific decoding logic

### Phase 4: Testing
- [ ] Test with SVG elevation drawings
- [ ] Test with SVG plan views
- [ ] Test with non-SVG images (PNG/JPG should still work)
- [ ] Verify stile widths stay constant when door width changes (36" → 60")
- [ ] Verify rail heights stay constant when door height changes
- [ ] Test multi-panel openings

## Implementation Details

### svg-renderer.ts Structure:
```typescript
import { Resvg } from '@resvg/resvg-js'
import { processParametricSVG } from './parametric-svg'

export interface RenderOptions {
  width: number
  height: number
  background?: string
  mode?: 'elevation' | 'plan'
}

export async function renderSvgToPng(
  svgString: string,
  options: RenderOptions
): Promise<string> {
  // 1. Apply parametric scaling
  const { scaledSVG } = processParametricSVG(svgString, options, options.mode)

  // 2. Render to PNG using resvg
  const resvg = new Resvg(scaledSVG, {
    background: options.background || '#ffffff',
    fitTo: {
      mode: 'width',
      value: options.width
    }
  })

  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()

  // 3. Convert to base64
  return pngBuffer.toString('base64')
}

export function isSvgFile(fileName?: string): boolean {
  return fileName?.toLowerCase().endsWith('.svg') || false
}
```

### API Endpoint Updates:

**Elevation Route:**
```typescript
import { renderSvgToPng, isSvgFile } from '@/lib/svg-renderer'

// Inside the loop for each panel
if (panel.componentInstance?.product?.elevationImageData) {
  let imageData = panel.componentInstance.product.elevationImageData
  const fileName = panel.componentInstance.product.elevationFileName

  // If SVG, render to PNG server-side
  if (isSvgFile(fileName)) {
    // Decode SVG
    const svgString = Buffer.from(imageData, 'base64').toString('utf-8')

    // Render to PNG with panel dimensions
    imageData = await renderSvgToPng(svgString, {
      width: panel.width,
      height: panel.height,
      mode: 'elevation'
    })
  }

  elevationImages.push({
    productName: panel.componentInstance.product.name,
    imageData: imageData,
    fileName: fileName,
    width: panel.width,
    height: panel.height
  })
}
```

**DrawingViewer Simplification:**
```typescript
// Remove processImage function entirely
// Replace with simple display:

{drawingData.elevationImages.map((img, index) => {
  const imageSrc = img.imageData.startsWith('data:')
    ? img.imageData
    : `data:image/png;base64,${img.imageData}`

  return (
    <img
      key={index}
      src={imageSrc}
      alt={img.productName}
      className="h-auto"
      style={{ maxHeight: '400px', display: 'block' }}
    />
  )
})}
```

## Success Criteria

### Functional Requirements:
- [x] SVG drawings render correctly with parametric scaling
- [ ] Stile widths remain constant when door width changes (36" → 60")
- [ ] Rail heights remain constant when door height changes
- [ ] No gaps between components in multi-panel openings
- [ ] All components visible within viewport
- [ ] PNG quality is acceptable for shop drawings

### Technical Requirements:
- [ ] Server-side rendering completes in < 500ms per drawing
- [ ] Memory usage stays reasonable (< 100MB per request)
- [ ] Works with both elevation and plan views
- [ ] Handles non-SVG images (PNG/JPG) without breaking
- [ ] No client-side SVG processing code remains

### Verification Tests:
1. **Constant Stile Width Test:**
   - Door A: 36" wide × 96" tall (stile = 4" wide in real world)
   - Door B: 60" wide × 96" tall (stile should still = 4" wide)
   - Visual check: Stiles should appear same thickness

2. **Constant Rail Height Test:**
   - Door A: 36" wide × 84" tall (rail = 6" tall in real world)
   - Door B: 36" wide × 96" tall (rail should still = 6" tall)
   - Visual check: Rails should appear same thickness

3. **Multi-Panel Test:**
   - 3-panel opening with different products
   - All panels should align seamlessly
   - No gaps or overlaps

## Migration Notes

### Breaking Changes:
- None - API endpoints return same data structure
- Client-side code simplified (removal only)
- PNG format instead of SVG (user doesn't see difference)

### Rollback Plan:
If server-side rendering has issues:
1. Keep old `processImage()` function commented in DrawingViewer
2. API endpoints can return raw SVG data
3. Uncomment client-side processing as fallback

### Performance Considerations:
- **Pros:** Correct rendering, no browser limitations
- **Cons:** Slightly slower API response (rendering time)
- **Mitigation:** Consider caching rendered PNGs in future

## Future Enhancements
- [ ] Cache rendered PNGs to avoid re-rendering
- [ ] Add PNG resolution parameter for print-quality output
- [ ] Support PDF export using rendered PNGs
- [ ] Add watermarking capability

## Changes Made
(Will be updated during execution)

## Testing Performed
(Will be updated after completion)

## Notes
- This matches SHOPGEN's approach exactly (Python cairosvg → Node.js resvg-js)
- Rendering happens once on server, not every time user views drawing
- Future caching will eliminate rendering overhead entirely
