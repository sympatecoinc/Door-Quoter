# Fix SVG Parametric Scaling
Date: 2025-10-01

## Scope
Files to modify:
- `src/lib/parametric-svg.ts` - Complete rewrite of stile width detection and element scaling logic

## Root Cause Analysis

### Current Implementation Problems:
1. **Stile width detection happens in ORIGINAL coordinates** (lines 343-380)
   - Detects `leftStileWidth = 4`, `rightStileWidth = 4` from original SVG
   - These are NOT scaled by height factor yet

2. **Rails use UNSCALED stile widths** (line 191-192)
   ```typescript
   const newX = leftStileWidth * scaling.scaleY  // 4 * 1.0 = 4
   const rightStileScaled = rightStileWidth * scaling.scaleY  // 4 * 1.0 = 4
   ```
   - But the stiles themselves are being scaled by scaleY (line 144)
   - Creates mismatch between stile actual width and rail positioning

3. **Right stile positioning uses scaled width** (line 148)
   ```typescript
   element.setAttribute('x', (targetDimensions.width - scaledWidth).toString())
   ```
   - If door is 60" wide, stile is 4", this sets x = 60 - 4 = 56"
   - But viewBox is `0 0 60 96`, so x=56 is INSIDE the viewport, not at edge

### SHOPGEN's Correct Approach:
1. **Pre-calculate scaled stile widths BEFORE processing** (lines 500-531)
   ```python
   adobe_width = stile_info['width'] * (target_height / original_height)
   left_stile_width = adobe_width  # Store PRE-SCALED width
   ```

2. **Use pre-scaled widths for ALL positioning** (line 659-660)
   ```python
   element.set('x', str(left_stile_width))  # Already scaled
   element.set('width', str(target_width - left_stile_width - right_stile_width))
   ```

3. **Right stile uses PRE-SCALED width** (line 608)
   ```python
   element.set('x', str(target_width - adobe_width))  # adobe_width is already scaled
   ```

## Tasks

- [ ] Task 1: Remove first pass stile detection (lines 343-380)
- [ ] Task 2: Add THREE-PASS approach:
  - Pass 1: Detect original stile widths
  - Pass 2: Calculate SCALED stile widths (width * scaleY)
  - Pass 3: Process all elements using scaled stile widths
- [ ] Task 3: Update vertical element logic to use PRE-SCALED widths for positioning
- [ ] Task 4: Update horizontal element logic to use PRE-SCALED stile widths directly (no additional scaling)
- [ ] Task 5: Update glassstop logic to use PRE-SCALED stile widths
- [ ] Task 6: Test with door width 36" → 60" (verify stile widths stay constant)
- [ ] Task 7: Test with door height changes (verify rail heights stay constant)

## Success Criteria
- Vertical stiles maintain constant WIDTH when door width changes (36" → 60")
- Vertical stiles maintain constant REAL-WORLD width when door height changes
- Right stile positioned exactly at right edge (x = targetWidth - scaledStileWidth)
- Horizontal rails maintain constant HEIGHT when door height changes
- Horizontal rails maintain constant REAL-WORLD height when door width changes
- No gaps between components
- No components outside viewport

## Implementation Details

### Pass 1: Detect Original Stile Widths
```typescript
let leftStileOriginalWidth = 0
let rightStileOriginalWidth = 0

elements.forEach(element => {
  if (element.tagName === 'rect') {
    const componentType = detectComponentType(element)
    if (componentType === 'vertical') {
      const x = parseFloat(element.getAttribute('x') || '0')
      const width = parseFloat(element.getAttribute('width') || '0')

      if (x > originalDimensions.width * 0.5) {
        rightStileOriginalWidth = width
      } else {
        leftStileOriginalWidth = width
      }
    }
  }
})
```

### Pass 2: Calculate Scaled Stile Widths
```typescript
// Scale by HEIGHT factor (SHOPGEN approach)
const leftStileWidth = leftStileOriginalWidth * scaling.scaleY
const rightStileWidth = rightStileOriginalWidth * scaling.scaleY

console.log(`Scaled stile widths: left=${leftStileWidth}, right=${rightStileWidth}`)
```

### Pass 3: Process Elements
- Vertical stiles: Use `leftStileWidth` and `rightStileWidth` directly (already scaled)
- Horizontal rails: Use `leftStileWidth` and `rightStileWidth` directly (no additional scaling)
- Right stile position: `x = targetDimensions.width - rightStileWidth` (rightStileWidth already scaled)

## Changes Made
(Will be updated during execution)

## Testing Performed
(Will be updated after completion)

## Notes
- SHOPGEN pre-scales stile widths before ANY element processing
- This ensures consistent dimensions throughout the scaling process
- The key insight: Store SCALED dimensions, not original dimensions
