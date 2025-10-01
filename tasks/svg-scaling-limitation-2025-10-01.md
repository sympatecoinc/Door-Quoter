# SVG Parametric Scaling - Fundamental Limitation

Date: 2025-10-01

## Problem Statement
User requirement: When door width changes, vertical stiles should maintain constant width (not get wider/thinner).

## Root Cause: SVG viewBox Limitation

### How SVG viewBox Works
When you set `<svg viewBox="0 0 50 96" width="100" height="200">`:
- The browser maps the viewBox coordinate system (50x96) to the display size (100x200)
- This creates a **uniform transformation matrix** that scales EVERYTHING by width ratio (2x) and height ratio (2.08x)
- There is **NO WAY** to make some elements scale differently than others within the same viewBox

### What We've Been Trying
- Modify element widths/heights directly in the SVG
- Change viewBox to target dimensions
- Keep viewBox at original dimensions
- Use transforms to counter-scale

**All of these fail** because the viewBox transformation happens AFTER all our modifications, uniformly affecting everything.

### Why SHOPGEN Works
SHOPGEN (lines 810-816 of app.py):
```python
png_data = cairosvg.svg2png(
    bytestring=scaled_svg.encode('utf-8'),
    output_width=png_width,
    output_height=png_height
)
```

They **convert the SVG to PNG** on the server using cairosvg. The browser displays a rasterized image, not an SVG with a viewBox.

## Solutions

### Option 1: Server-Side SVG to PNG Conversion (SHOPGEN Approach)
**Pros:**
- Will work exactly like SHOPGEN
- Stiles maintain constant width
- No browser viewBox issues

**Cons:**
- Requires Node.js server-side rendering
- Need to install/configure svg rendering library (sharp, puppeteer, or similar)
- Adds complexity and dependencies
- Slower performance (rendering on each request)

**Implementation:**
1. Create API endpoint `/api/render-svg`
2. Install sharp or puppeteer
3. Render SVG to PNG server-side
4. Return PNG data URL to browser

### Option 2: Accept Uniform Scaling (Simple)
**Pros:**
- No code changes needed
- Fast and simple
- SVG remains vector (scalable, sharp)

**Cons:**
- Stiles get wider when door gets wider
- Not meeting user requirement

**Implementation:**
- Remove parametric-svg.ts processing
- Display SVG as-is with standard scaling

### Option 3: Hybrid - CSS Transform with overflow:hidden
**Pros:**
- No server-side rendering
- Might work for basic cases

**Cons:**
- Complex CSS transforms needed
- May have edge cases/bugs
- Still limited by browser rendering

**Implementation:**
- Wrap SVG in container
- Use CSS `transform: scale(x, y)` with different x/y values
- Use `overflow: hidden` to crop

## Recommendation

**Option 1 (Server-Side PNG)** is the only solution that truly works, matching SHOPGEN's approach.

**Estimated effort:** 4-6 hours
- Install rendering library: 1 hour
- Create API endpoint: 1 hour
- Integrate with DrawingViewer: 1 hour
- Testing and debugging: 1-3 hours

## Decision Required

Which option should we pursue?
