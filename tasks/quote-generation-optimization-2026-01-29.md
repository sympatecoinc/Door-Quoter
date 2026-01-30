# Quote Generation Memory Optimization Plan
Date: 2026-01-29

## Problem Analysis

The quote generation for project 91 (1901 Howard) was failing due to memory exhaustion:
- **Memory limit**: 512 MiB
- **Actual usage**: 513-554 MiB (exceeding limit)
- **Result**: Container terminated → 503 error

After increasing memory to 1Gi, the quote generated successfully, confirming memory is the bottleneck.

## Current Architecture (Memory Hotspots)

### 1. Quote Generation Flow (`/api/projects/[id]/quote/route.ts`)
```
Request → Fetch Project → For each Opening (in parallel via Promise.all):
  → Internal HTTP call to /api/drawings/elevation/{openingId}
    → For each Panel:
      → Decode SVG
      → Apply parametric scaling
      → Fetch hardware images from filesystem
      → Inject hardware into SVG
      → Create Resvg instance (MEMORY HEAVY)
      → Render to PNG buffer (MEMORY HEAVY)
      → Convert to base64 (DOUBLES MEMORY)
  → Return elevation images
→ Aggregate all images → Return quote data
```

### 2. Memory Consumption Points

| Component | Memory Impact | Notes |
|-----------|--------------|-------|
| `Promise.all()` for openings | HIGH | All openings processed simultaneously |
| Resvg instances | HIGH | Native rendering context per panel |
| PNG buffers | HIGH | 24px/inch = 576x2304 pixels per panel |
| Base64 encoding | MEDIUM | Doubles buffer size temporarily |
| No caching | HIGH | Same drawings re-rendered every request |

### 3. Observed Metrics (Project 91 - 1901 Howard)
- ~20+ elevation drawing requests
- Each request: 9-12 seconds
- Multiple SVG→PNG conversions per opening
- All happening in parallel

## Optimization Strategies

### Phase 1: Quick Wins (Immediate Impact)

#### 1.1 Sequential Batch Processing
**File**: `src/app/api/projects/[id]/quote/route.ts`

Replace `Promise.all()` with sequential batch processing:

```typescript
// Current (memory-intensive):
const quoteItems = await Promise.all(
  sortedOpenings.map(async (opening) => { ... })
)

// Optimized (batched):
const BATCH_SIZE = 3;
const quoteItems = [];
for (let i = 0; i < sortedOpenings.length; i += BATCH_SIZE) {
  const batch = sortedOpenings.slice(i, i + BATCH_SIZE);
  const batchResults = await Promise.all(
    batch.map(async (opening) => { ... })
  );
  quoteItems.push(...batchResults);
  // Allow GC between batches
  if (global.gc) global.gc();
}
```

**Impact**: Reduces peak memory by ~60-70%

#### 1.2 Reduce PNG Resolution for Quotes
**File**: `src/app/api/drawings/elevation/[openingId]/route.ts`

```typescript
// Current:
const pixelsPerInch = 24

// Optimized for quote preview:
const pixelsPerInch = 12  // Half resolution for quote display
```

**Impact**: Reduces PNG buffer size by 75%

#### 1.3 Clear Buffers After Base64 Conversion
**File**: `src/app/api/drawings/elevation/[openingId]/route.ts`

```typescript
const pngData = resvg.render()
const pngBuffer = pngData.asPng()
imageData = pngBuffer.toString('base64')

// Clear the buffer reference
pngBuffer.fill(0)
```

**Impact**: Frees memory sooner

### Phase 2: Caching (Medium-term)

#### 2.1 In-Memory Drawing Cache
**New File**: `src/lib/drawing-cache.ts`

```typescript
import NodeCache from 'node-cache'

// Cache with 10-minute TTL
const drawingCache = new NodeCache({
  stdTTL: 600,
  maxKeys: 100,
  useClones: false  // Don't clone large buffers
})

export function getCacheKey(openingId: number, panelId: number, version: string): string {
  return `elevation:${openingId}:${panelId}:${version}`
}

export function getCachedDrawing(key: string): string | undefined {
  return drawingCache.get(key)
}

export function setCachedDrawing(key: string, base64Data: string): void {
  drawingCache.set(key, base64Data)
}
```

**Cache Invalidation**: Invalidate when panel dimensions, hardware, or SVG template changes.

#### 2.2 Version-Based Cache Keys
Use a hash of relevant panel properties as version:

```typescript
function getPanelVersion(panel: Panel): string {
  const data = JSON.stringify({
    width: panel.width,
    height: panel.height,
    subOptionSelections: panel.componentInstance?.subOptionSelections,
    productId: panel.componentInstance?.productId
  })
  return crypto.createHash('md5').update(data).digest('hex').slice(0, 8)
}
```

**Impact**: Eliminates re-rendering of unchanged drawings

### Phase 3: Lazy Loading (Longer-term)

#### 3.1 Deferred Drawing Generation
Only generate drawings when PDF is requested, not for quote preview:

```typescript
// Quote API returns placeholder references
{
  elevationImages: [
    { ref: 'opening:123:panel:456', dimensions: { width: 48, height: 96 } }
  ]
}

// PDF generator fetches actual images on-demand
async function generatePDF(quoteData) {
  for (const item of quoteData.quoteItems) {
    for (const ref of item.elevationImages) {
      const imageData = await fetchDrawingOnDemand(ref)
      // Add to PDF immediately, don't hold all in memory
    }
  }
}
```

**Impact**: Quote preview is instant; PDF generation is memory-efficient

#### 3.2 Streaming PDF Generation
Generate PDF pages one at a time, not all in memory:

```typescript
// Use pdf-lib streaming or chunk-based approach
async function* generatePDFPages(quoteData) {
  for (const item of quoteData.quoteItems) {
    const pageBuffer = await generateSinglePage(item)
    yield pageBuffer
    // Memory freed after yield
  }
}
```

### Phase 4: Infrastructure (If Needed)

#### 4.1 Cloud Run Memory Tuning
Current: 1Gi memory
Recommended: Keep at 1Gi with optimizations, can reduce back to 512Mi after Phase 2

#### 4.2 Separate Drawing Service (Future)
For very large projects, offload drawing generation to a separate service:
- Dedicated Cloud Run service with higher memory
- Pre-render drawings on project save
- Store in Cloud Storage
- Quote/PDF generation fetches pre-rendered images

## Implementation Order

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 1 | Sequential batch processing | 1 hour | HIGH |
| 2 | Reduce PNG resolution | 15 min | MEDIUM |
| 3 | Clear buffers explicitly | 15 min | LOW |
| 4 | In-memory drawing cache | 2 hours | HIGH |
| 5 | Lazy drawing generation | 4 hours | HIGH |
| 6 | Streaming PDF generation | 4 hours | MEDIUM |

## Success Criteria

- [ ] Quote generation works within 512Mi memory limit
- [ ] Quote generation time reduced by 50%
- [ ] No 503 errors for projects with 20+ openings
- [ ] PDF generation works for projects with 50+ openings

## Files to Modify

1. `src/app/api/projects/[id]/quote/route.ts` - Batch processing
2. `src/app/api/drawings/elevation/[openingId]/route.ts` - Resolution, memory cleanup
3. `src/lib/drawing-cache.ts` (new) - Caching layer
4. `src/lib/quote-pdf-generator.ts` - Streaming generation

## Testing

1. Test with project 91 (1901 Howard) - 20+ openings
2. Monitor memory usage in Cloud Run logs
3. Measure quote generation time before/after
4. Verify image quality is acceptable at reduced resolution

## Notes

- The 1Gi memory limit is a good safety buffer while implementing optimizations
- Once Phase 2 (caching) is complete, consider reducing back to 512Mi
- Monitor Cloud Run costs - memory increase does impact pricing
