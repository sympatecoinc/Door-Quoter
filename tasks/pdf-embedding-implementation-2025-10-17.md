# PDF Embedding Implementation for Quote Documents
Date: 2025-10-17

## Problem Statement
Currently, when quote documents (persistent spec sheets, brochures, etc.) are included in generated quote PDFs, PDF files show a placeholder message "(PDF embedding coming soon)" instead of the actual document content. This needs to be implemented to provide complete quote packages.

## Current Architecture

### How It Works Now
1. **Document Storage**: Quote documents are stored in `/public/uploads/quote-documents/[docId]/[filename]`
2. **Document Fetching**: Route `/api/projects/[id]/quote/pdf/route.ts` fetches:
   - Global documents (isGlobal: true)
   - Product-specific documents (based on products used in the quote)
3. **PDF Generation**: `quote-pdf-generator.ts` creates the PDF using jsPDF:
   - Handles images (PNG, JPEG) successfully
   - Shows placeholder for PDF documents (line 476-485)

### Current Flow
```
route.ts (lines 282-356) → Fetches quote documents from database
    ↓
    Combines with project attachments
    ↓
quote-pdf-generator.ts → createQuotePDF()
    ↓
    addAttachmentPage() → Detects file type
    ↓
    If PDF: Shows placeholder "(PDF embedding coming soon)"
```

## Technical Challenge

**The Problem**: jsPDF cannot directly merge/embed existing PDF files. It can only:
- Create new PDF pages
- Add images to pages
- Add text to pages

**The Solution**: We need a library that can handle PDF manipulation at the document level.

## Proposed Solution

### Option 1: Use pdf-lib (RECOMMENDED)
**Library**: `pdf-lib` - Modern PDF manipulation library for JavaScript/TypeScript
- Can read existing PDFs
- Can merge PDFs
- Works in Node.js environment
- Good TypeScript support
- Active maintenance

### Option 2: Use PDFKit with pdf-merger-js
**Alternative**: Combination of libraries
- More complex setup
- Less integrated

## Implementation Plan

### Scope
Files to modify:
- `package.json`: Add pdf-lib dependency
- `src/lib/quote-pdf-generator.ts`: Implement PDF merging logic
- `src/app/api/projects/[id]/quote/pdf/route.ts`: Update to use new PDF merging approach

### Tasks

#### Phase 1: Setup and Infrastructure
- [ ] Install pdf-lib library: `npm install pdf-lib`
- [ ] Research pdf-lib API for merging PDFs with jsPDF-generated content
- [ ] Determine architecture:
  - Option A: Generate jsPDF → Convert to pdf-lib → Merge attachments
  - Option B: Use pdf-lib for everything (major refactor, NOT recommended)
  - **Recommendation**: Option A

#### Phase 2: Core Implementation
- [ ] Create utility function to convert jsPDF output to pdf-lib PDFDocument
- [ ] Create utility function to load and validate PDF attachments from filesystem
- [ ] Implement PDF merging function:
  - Takes main quote PDF (from jsPDF)
  - Takes array of attachment file paths
  - Returns merged PDF as buffer
- [ ] Update `addAttachmentPage()` to handle PDFs:
  - Remove placeholder text
  - Mark that PDF will be merged later (not embedded in jsPDF)
- [ ] Update `createQuotePDF()` to track which attachments are PDFs vs images

#### Phase 3: Route Integration
- [ ] Modify `/api/projects/[id]/quote/pdf/route.ts`:
  - After creating jsPDF, check if any attachments are PDFs
  - If yes: Convert jsPDF to pdf-lib, merge PDF attachments, return merged buffer
  - If no: Return jsPDF as-is (current behavior)
- [ ] Handle file path resolution for both persistent docs and project attachments

#### Phase 4: Testing and Edge Cases
- [ ] Test with single PDF attachment
- [ ] Test with multiple PDF attachments
- [ ] Test with mixed PDF + image attachments
- [ ] Test with no PDF attachments (ensure no regression)
- [ ] Test with corrupted/invalid PDF files (error handling)
- [ ] Test with large PDF files (performance)
- [ ] Verify correct ordering: Quote pages → Images → PDFs (or mixed based on displayOrder)

#### Phase 5: Polish and Documentation
- [ ] Add error handling for PDF loading failures
- [ ] Add logging for debugging PDF merging issues
- [ ] Update any relevant documentation
- [ ] Clean up placeholder code/comments

## Success Criteria
- [ ] PDF quote documents appear in generated quotes with full content
- [ ] Image attachments continue to work as before (no regression)
- [ ] Documents appear in correct order (respecting displayOrder)
- [ ] Global and product-specific PDFs both embed correctly
- [ ] Error handling gracefully handles missing or corrupted PDFs
- [ ] Performance is acceptable (< 5 seconds for typical quote with 2-3 PDF attachments)

## Technical Design Details

### Proposed Architecture (Option A)

```typescript
// New utility functions in quote-pdf-generator.ts

/**
 * Converts jsPDF output to pdf-lib PDFDocument
 */
async function jsPdfToPdfLib(jsPdf: jsPDF): Promise<PDFDocument> {
  const arrayBuffer = jsPdf.output('arraybuffer')
  return await PDFDocument.load(arrayBuffer)
}

/**
 * Merges PDF attachments into the main quote PDF
 */
async function mergePdfAttachments(
  mainPdf: PDFDocument,
  attachmentPaths: string[]
): Promise<PDFDocument> {
  for (const attachmentPath of attachmentPaths) {
    const attachmentBytes = await fs.readFile(attachmentPath)
    const attachmentPdf = await PDFDocument.load(attachmentBytes)

    // Copy all pages from attachment to main PDF
    const pages = await mainPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices())
    pages.forEach(page => mainPdf.addPage(page))
  }

  return mainPdf
}
```

### Updated createQuotePDF signature

```typescript
export async function createQuotePDF(
  quoteData: QuoteData,
  attachments: QuoteAttachment[] = []
): Promise<Buffer> { // Changed return type from jsPDF to Buffer
  // 1. Create jsPDF with quote pages and image attachments
  const pdf = new jsPDF(...)

  // 2. Add quote page
  await addQuotePage(pdf, quoteData)

  // 3. Separate PDF attachments from image attachments
  const imageAttachments = attachments.filter(a => a.mimeType.startsWith('image/'))
  const pdfAttachments = attachments.filter(a => a.mimeType === 'application/pdf')

  // 4. Add image attachments as jsPDF pages
  for (const attachment of imageAttachments) {
    pdf.addPage()
    await addAttachmentPage(pdf, attachment, projectId)
  }

  // 5. If no PDF attachments, return jsPDF as buffer
  if (pdfAttachments.length === 0) {
    return Buffer.from(pdf.output('arraybuffer'))
  }

  // 6. Convert jsPDF to pdf-lib and merge PDF attachments
  let finalPdf = await jsPdfToPdfLib(pdf)

  for (const attachment of pdfAttachments) {
    const pdfPath = resolvePdfPath(attachment, projectId)
    const attachmentBytes = await fs.promises.readFile(pdfPath)
    const attachmentPdf = await PDFDocument.load(attachmentBytes)

    const pages = await finalPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices())
    pages.forEach(page => finalPdf.addPage(page))
  }

  // 7. Return final merged PDF as buffer
  const mergedBytes = await finalPdf.save()
  return Buffer.from(mergedBytes)
}
```

### Changes to route.ts

```typescript
// In route.ts, change from:
const pdf = await createQuotePDF(quoteData, allAttachments as any)
const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))

// To:
const pdfBuffer = await createQuotePDF(quoteData, allAttachments as any)
```

## Ordering Strategy

Documents should appear in this order:
1. Main quote pages (pricing, line items)
2. All attachments in order of `displayOrder` field (mixed images and PDFs)

The current code adds project attachments first, then persistent documents. We should maintain this order but respect displayOrder within each group.

## Error Handling Strategy

1. **Missing PDF file**: Log error, add placeholder page with error message, continue with other attachments
2. **Corrupted PDF file**: Same as above
3. **pdf-lib loading error**: Same as above
4. **Out of memory**: Return error response to user (don't crash server)

## Performance Considerations

- PDF merging is CPU-intensive
- Large PDFs (> 10MB) may take several seconds
- Consider adding progress indicators for long operations
- May want to add file size limits (e.g., 50MB total per quote)

## Future Enhancements (Out of Scope for This Task)

- Add page numbers to merged PDF
- Add table of contents
- Compress final PDF
- Cache merged PDFs for repeat downloads
- Support other document types (Word, Excel) by converting to PDF first

## Notes

- The current code already correctly identifies PDF vs image attachments by mimeType
- The file path resolution logic is already implemented (lines 441-462 in quote-pdf-generator.ts)
- Project attachments and persistent documents already have different storage paths handled
- displayOrder field exists in database and is already being used for sorting

## Estimated Complexity

- **Setup**: 30 minutes (install library, research API)
- **Core Implementation**: 2-3 hours (PDF merging logic)
- **Integration**: 1-2 hours (route updates, testing integration)
- **Testing**: 1-2 hours (edge cases, error handling)
- **Total**: 4-7 hours

## Changes Made

### 1. Installed pdf-lib library
- Added `pdf-lib` package via `npm install pdf-lib`

### 2. Updated quote-pdf-generator.ts (src/lib/quote-pdf-generator.ts)

**Imports:**
- Added `import { PDFDocument } from 'pdf-lib'`

**Function signature change:**
- Changed `createQuotePDF()` return type from `Promise<jsPDF>` to `Promise<Buffer>`
- Now returns a Buffer directly instead of a jsPDF object

**Core logic updates in createQuotePDF():**
- Separates attachments into image and PDF categories
- Adds image attachments to jsPDF as before (maintains backward compatibility)
- If no PDF attachments exist, returns jsPDF as Buffer directly (fast path)
- If PDF attachments exist:
  - Converts jsPDF output to pdf-lib PDFDocument via `PDFDocument.load()`
  - Iterates through each PDF attachment
  - Loads each PDF using pdf-lib
  - Copies all pages from attachment to main PDF
  - Returns merged PDF as Buffer

**Error handling:**
- Missing PDF files: Adds placeholder page with error message
- Corrupted PDF files: Adds error page with red text indicating failure
- Overall merge failure: Falls back to returning jsPDF without PDF attachments

**New helper function:**
- `resolveAttachmentPath()`: Centralized function to resolve filesystem paths for both persistent quote documents and project-specific attachments

### 3. Updated route.ts (src/app/api/projects/[id]/quote/pdf/route.ts)

**Changes:**
- Simplified PDF generation call (line 358-359)
- Changed from:
  ```typescript
  const pdf = await createQuotePDF(quoteData, allAttachments as any)
  const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))
  ```
- To:
  ```typescript
  const pdfBuffer = await createQuotePDF(quoteData, allAttachments as any)
  ```
- No other changes needed since the route already handled Buffer output

### Files Modified
- `/home/kyle/projects/Door-Quoter/package.json` (added pdf-lib dependency)
- `/home/kyle/projects/Door-Quoter/src/lib/quote-pdf-generator.ts` (core implementation)
- `/home/kyle/projects/Door-Quoter/src/app/api/projects/[id]/quote/pdf/route.ts` (simplified API call)

### Implementation Notes
- The implementation follows Option A from the plan (keep jsPDF, add pdf-lib for merging)
- No changes needed to addAttachmentPage() - it's only called for image attachments now
- PDF attachments are completely handled by pdf-lib merging
- Maintains correct ordering: Quote pages → Image attachments → PDF attachments (in order of displayOrder)

## Testing Performed
(To be updated after testing)
