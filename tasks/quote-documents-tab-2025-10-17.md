# Quote Documents Tab
Date: 2025-10-17

## Overview
Add a new "Documents" tab to the dashboard that allows users to manage persistent documents that will always be included with quotes. Additionally, allow certain documents to be tied to specific products so they automatically appear in quotes when those products are used.

## Scope

### Database Changes
Files to modify:
- `prisma/schema.prisma` - Add new models for persistent quote documents and product-document relationships

### Backend API Routes
Files to create:
- `src/app/api/quote-documents/route.ts` - CRUD operations for quote documents
- `src/app/api/quote-documents/[id]/route.ts` - Single document operations (GET, PUT, DELETE)
- `src/app/api/quote-documents/[id]/download/route.ts` - Download document file
- `src/app/api/products/[id]/documents/route.ts` - Manage product-document associations

### Frontend Components
Files to create:
- `src/components/views/QuoteDocumentsView.tsx` - Main view for the Documents tab
- `src/components/quote-documents/DocumentsList.tsx` - List and manage all quote documents
- `src/components/quote-documents/DocumentUpload.tsx` - Upload new documents with metadata
- `src/components/quote-documents/ProductAssociations.tsx` - Manage product-document associations

Files to modify:
- `src/components/Sidebar.tsx` - Add "Documents" menu item
- `src/components/Dashboard.tsx` - Add route for 'quoteDocuments' menu
- `src/stores/appStore.ts` - Add 'quoteDocuments' to MenuOption type
- `src/types/index.ts` - Add 'quoteDocuments' to MenuOption type
- `src/lib/quote-pdf-generator.ts` - Update to include persistent documents in quote PDFs
- `src/app/api/projects/[id]/quote/pdf/route.ts` - Include persistent documents when generating quote PDFs

## Database Schema Design

### QuoteDocument Model
```prisma
model QuoteDocument {
  id               Int                    @id @default(autoincrement())
  name             String                 // Display name
  description      String?                // Optional description
  filename         String                 // Stored filename
  originalName     String                 // Original upload filename
  mimeType         String                 // File MIME type
  size             Int                    // File size in bytes
  category         String                 @default("general") // "spec_sheet", "brochure", "warranty", "installation", "general"
  isGlobal         Boolean                @default(true) // If true, included in all quotes
  displayOrder     Int                    @default(0) // Order in PDFs
  uploadedBy       String?                // User who uploaded
  createdAt        DateTime               @default(now())
  updatedAt        DateTime               @updatedAt
  productDocuments ProductQuoteDocument[] // Products this document is associated with

  @@map("QuoteDocuments")
}

model ProductQuoteDocument {
  id              Int           @id @default(autoincrement())
  productId       Int
  quoteDocumentId Int
  createdAt       DateTime      @default(now())
  product         Product       @relation(fields: [productId], references: [id], onDelete: Cascade)
  quoteDocument   QuoteDocument @relation(fields: [quoteDocumentId], references: [id], onDelete: Cascade)

  @@unique([productId, quoteDocumentId])
  @@map("ProductQuoteDocuments")
}
```

## Tasks

- [ ] Task 1: Update database schema
  - Add QuoteDocument model to schema.prisma
  - Add ProductQuoteDocument junction table to schema.prisma
  - Add productDocuments relation to Product model
  - Create and run Prisma migration

- [ ] Task 2: Create backend API routes for quote documents
  - Create /api/quote-documents/route.ts (GET all, POST new)
  - Create /api/quote-documents/[id]/route.ts (GET, PUT, DELETE single)
  - Create /api/quote-documents/[id]/download/route.ts (download file)
  - Implement file storage in uploads/quote-documents/ directory
  - Add validation for file types and sizes

- [ ] Task 3: Create backend API for product-document associations
  - Create /api/products/[id]/documents/route.ts
  - Implement GET (list associated documents)
  - Implement POST (add association)
  - Implement DELETE (remove association)

- [ ] Task 4: Create QuoteDocumentsView component
  - Main view container with tabs/sections
  - Section 1: Global documents (always included)
  - Section 2: Product-specific documents
  - Integrate DocumentsList, DocumentUpload, ProductAssociations components

- [ ] Task 5: Create DocumentsList component
  - Display list of all quote documents
  - Show name, category, file info, global/product-specific status
  - Edit document metadata (name, description, category, isGlobal)
  - Delete documents
  - Reorder documents (drag & drop for displayOrder)
  - Preview/download documents

- [ ] Task 6: Create DocumentUpload component
  - File upload interface (drag & drop + click to upload)
  - Form to set name, description, category, isGlobal
  - Support PDF, PNG, JPG file types
  - Progress indicator during upload
  - Error handling

- [ ] Task 7: Create ProductAssociations component
  - UI to select a product from dropdown
  - Show documents currently associated with selected product
  - Add/remove document associations for the product
  - Visual indication of which products each document is tied to

- [ ] Task 8: Update navigation and routing
  - Add "Documents" menu item to Sidebar.tsx
  - Update MenuOption type in src/types/index.ts
  - Update appStore.ts MenuOption type
  - Add 'quoteDocuments' case in Dashboard.tsx renderView()

- [ ] Task 9: Update quote PDF generation to include persistent documents
  - Modify src/lib/quote-pdf-generator.ts
  - Fetch global quote documents
  - For each product in the quote, fetch associated product-specific documents
  - Deduplicate documents (if a global doc is also product-specific, include once)
  - Append documents to PDF based on displayOrder
  - Update /api/projects/[id]/quote/pdf/route.ts to use enhanced generator

- [ ] Task 10: Testing and validation
  - Test document upload and management
  - Test product associations
  - Test quote PDF generation with global documents
  - Test quote PDF generation with product-specific documents
  - Test document deduplication in PDFs
  - Test file download functionality
  - Test permission controls (if applicable)

## Success Criteria

- Users can upload persistent quote documents via the Documents tab
- Documents can be marked as global (included in all quotes) or product-specific
- Documents can be categorized (spec sheet, brochure, warranty, installation, general)
- Users can associate documents with specific products
- Global documents automatically appear in all quote PDFs
- Product-specific documents appear in quote PDFs when that product is used
- Documents are ordered correctly in PDFs based on displayOrder
- Documents can be previewed and downloaded
- Document metadata can be edited
- Documents can be deleted (with confirmation)
- UI is intuitive and consistent with existing patterns (similar to QuoteAttachmentsManager)

## Implementation Notes

### File Storage Structure
```
uploads/
  quote-documents/
    [document-id]/
      [filename]
```

### Category Options
- `spec_sheet` - Product specification sheets
- `brochure` - Marketing brochures
- `warranty` - Warranty information
- `installation` - Installation instructions
- `general` - General documents

### Deduplication Logic
When generating a quote PDF:
1. Fetch all global documents (isGlobal = true)
2. For each unique product in the quote, fetch associated product-specific documents
3. Create a Set of document IDs to ensure no duplicates
4. Sort by displayOrder
5. Append to PDF

### Security Considerations
- Validate file types on upload (only PDF, PNG, JPG)
- Enforce file size limits (max 10MB per file)
- Sanitize filenames to prevent path traversal attacks
- Check user permissions before allowing upload/delete operations
- Validate document ownership/access before download

## Changes Made

### Database Schema (prisma/schema.prisma)
- Added `QuoteDocument` model with fields for name, description, filename, mimeType, size, category, isGlobal, displayOrder, uploadedBy
- Added `ProductQuoteDocument` junction table to link products with quote documents
- Added `productDocuments` relation to Product model
- Ran `prisma db push` to update database schema

### Backend API Routes
- Created `/api/quote-documents/route.ts` - GET (list all), POST (upload new)
- Created `/api/quote-documents/[id]/route.ts` - GET, PUT (update metadata), DELETE
- Created `/api/quote-documents/[id]/download/route.ts` - Download document file
- Created `/api/products/[id]/documents/route.ts` - GET, POST, DELETE product-document associations

### Frontend Components
- Created `src/components/quote-documents/DocumentUpload.tsx` - File upload with metadata form
- Created `src/components/quote-documents/DocumentsList.tsx` - List, edit, delete, preview documents
- Created `src/components/quote-documents/ProductAssociations.tsx` - Manage product-document links
- Created `src/components/views/QuoteDocumentsView.tsx` - Main view with tabs for all/global/product-specific

### Navigation and Routing
- Updated `src/types/index.ts` - Added 'quoteDocuments' to MenuOption type
- Updated `src/components/Sidebar.tsx` - Added "Documents" menu item with FileText icon
- Updated `src/components/Dashboard.tsx` - Added route case for 'quoteDocuments'

### Quote PDF Generation
- Updated `src/app/api/projects/[id]/quote/pdf/route.ts`:
  - Fetch global quote documents
  - Fetch product-specific documents for products used in quote
  - Deduplicate documents (global + product-specific)
  - Combine with project-specific attachments
  - Pass all to PDF generator
- Updated `src/lib/quote-pdf-generator.ts`:
  - Modified `addAttachmentPage` to handle persistent documents with different file paths
  - Added `isPersistent` flag to distinguish between persistent and project-specific attachments

### File Storage
- Persistent documents stored in: `/public/uploads/quote-documents/[documentId]/[filename]`
- Project-specific attachments remain in: `/uploads/quote-attachments/[projectId]/[filename]`

## Testing Performed

### Build Verification
- ✅ Build completed successfully with no errors
- ✅ All TypeScript types compile correctly
- ✅ Prisma schema generated successfully
- ✅ All API routes registered correctly
- ✅ All new routes visible in build output:
  - `/api/quote-documents`
  - `/api/quote-documents/[id]`
  - `/api/quote-documents/[id]/download`
  - `/api/products/[id]/documents`

### Manual Testing Required
The following should be tested manually when the app is running:
1. Upload a new quote document (global)
2. Upload a product-specific quote document
3. Associate a document with a product
4. Remove product-document association
5. Edit document metadata
6. Delete a document
7. Preview an image document
8. Download a document
9. Generate a quote PDF and verify persistent documents are included
10. Verify deduplication (if a document is both global and product-specific, it appears once)
11. Test all three tabs (All, Global, Product-Specific)

## Notes
- This feature builds on the existing QuoteAttachmentsManager pattern
- QuoteAttachments are project-specific (tied to a single project)
- QuoteDocuments are persistent (reusable across all quotes)
- The Documents tab provides centralized management of reusable documents
- Consider adding a "templates" concept in the future for common document sets
