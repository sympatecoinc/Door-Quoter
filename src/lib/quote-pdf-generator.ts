// Quote PDF Generation Utility
// Uses jsPDF to create professional quote PDFs with optional attachments
// Uses pdf-lib to merge PDF attachments

import { jsPDF } from 'jspdf'
import { PDFDocument } from 'pdf-lib'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { renderSvgToPng, decodeSvgData } from './svg-renderer'
import { downloadFile } from './gcs-storage'

/**
 * Extracts width and height from PNG image data (base64 or buffer)
 * PNG header structure: first 8 bytes are signature, then IHDR chunk contains width/height
 */
function getPngDimensions(base64Data: string): { width: number, height: number } | null {
  try {
    const buffer = Buffer.from(base64Data, 'base64')

    // PNG signature check (first 8 bytes)
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    for (let i = 0; i < 8; i++) {
      if (buffer[i] !== pngSignature[i]) {
        return null // Not a valid PNG
      }
    }

    // IHDR chunk starts at byte 8, width at byte 16, height at byte 20 (big-endian)
    const width = buffer.readUInt32BE(16)
    const height = buffer.readUInt32BE(20)

    return { width, height }
  } catch (error) {
    console.error('Error reading PNG dimensions:', error)
    return null
  }
}

/**
 * Extracts dimensions from SVG viewBox attribute
 */
function getSvgDimensions(svgString: string): { width: number, height: number } | null {
  try {
    const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/)
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].split(/\s+/).map(parseFloat)
      if (parts.length >= 4) {
        return { width: parts[2], height: parts[3] }
      }
    }
    return null
  } catch (error) {
    return null
  }
}

// Plan view image with metadata for proper positioning
export interface PlanViewImage {
  imageData: string
  orientation?: string // 'bottom' or 'top' - determines vertical alignment
  width?: number // inches
  height?: number // inches
  productType?: string // SWING_DOOR, SLIDING_DOOR, FIXED_PANEL, etc.
  productName?: string
}

// Elevation view image with metadata for proportional width rendering
export interface ElevationViewImage {
  imageData: string
  width?: number // inches
  height?: number // inches
  productType?: string
  productName?: string
}

export interface QuoteItem {
  openingId: number
  name: string
  openingDirections?: string[] // Array of opening direction abbreviations (e.g., ['LH', 'RH'])
  description: string
  dimensions: string
  color: string
  hardware: string
  hardwarePrice: number
  glassType: string
  costPrice: number
  price: number
  elevationImages: string[] // For elevation view (just image data)
  planViewImages?: PlanViewImage[] // For plan view with metadata (triggers wall drawing)
  elevationViewImages?: ElevationViewImage[] // For elevation view with width metadata (no wall drawing)
}

export interface QuoteData {
  project: {
    id: number
    name: string
    status: string
    createdAt: string
    updatedAt: string
    pricingMode?: {
      name: string
      markup: number
      discount: number
    } | null
  }
  customer?: {
    companyName: string
    contactName?: string | null
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
  } | null
  companyLogo?: string | null // Path to company logo from branding settings
  quoteItems: QuoteItem[]
  subtotal: number
  markupAmount: number
  discountAmount: number
  adjustedSubtotal: number
  installationCost: number
  taxRate: number
  taxAmount: number
  totalPrice: number
}

export interface QuoteAttachment {
  id: number
  filename: string
  originalName: string
  mimeType: string
  type: string
  displayOrder: number
  position?: string
  description?: string | null
}

/**
 * Draws a hatched rectangle representing a wall section
 * Uses diagonal lines at 45 degrees for standard architectural wall indication
 */
function drawHatchedWall(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  hatchSpacing: number = 2
): void {
  // Draw outer rectangle
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.3)
  pdf.rect(x, y, width, height)

  // Draw diagonal hatch lines at 45 degrees
  // Lines go from lower-left to upper-right (in visual terms)
  // In PDF coords: from (lower X, higher Y) to (higher X, lower Y)
  pdf.setLineWidth(0.15)

  // Parameter d represents offset along the diagonal
  // Each line satisfies: (x' - x) + (y' - y) = d for points on the line
  const totalDiagonal = width + height

  for (let d = hatchSpacing; d < totalDiagonal; d += hatchSpacing) {
    let x1: number, y1: number, x2: number, y2: number

    // Find the two intersection points of the line with the rectangle
    if (d <= width && d <= height) {
      // Line intersects left edge and top edge
      x1 = x
      y1 = y + d
      x2 = x + d
      y2 = y
    } else if (d <= width && d > height) {
      // Line intersects bottom edge and top edge
      x1 = x + (d - height)
      y1 = y + height
      x2 = x + d
      y2 = y
    } else if (d > width && d <= height) {
      // Line intersects left edge and right edge
      x1 = x
      y1 = y + d
      x2 = x + width
      y2 = y + (d - width)
    } else {
      // d > width && d > height
      // Line intersects bottom edge and right edge
      x1 = x + (d - height)
      y1 = y + height
      x2 = x + width
      y2 = y + (d - width)
    }

    pdf.line(x1, y1, x2, y2)
  }
}

/**
 * Creates a complete quote PDF with optional attachments
 * Returns a Buffer containing the final PDF (either jsPDF only or merged with PDF attachments)
 *
 * Document order:
 * 1. Beginning attachments (position: 'beginning')
 * 2. Quote page with totals
 * 3. After-quote attachments (position: 'after_quote')
 * 4. Persistent documents - product docs / global pages (position: 'persistent')
 * 5. End attachments (position: 'end')
 */
export async function createQuotePDF(
  quoteData: QuoteData,
  attachments: QuoteAttachment[] = []
): Promise<Buffer> {
  // Separate attachments by position
  // Support legacy 'before'/'after' values for backwards compatibility
  const beginningAttachments = attachments.filter(a => a.position === 'beginning' || a.position === 'before')
  const afterQuoteAttachments = attachments.filter(a => a.position === 'after_quote' || a.position === 'after' || (!a.position && !(a as any).isPersistent))
  const persistentAttachments = attachments.filter(a => a.position === 'persistent' || (a as any).isPersistent)
  const endAttachments = attachments.filter(a => a.position === 'end')

  // Further separate by type
  const beginningImages = beginningAttachments.filter(a => a.mimeType.startsWith('image/'))
  const beginningPdfs = beginningAttachments.filter(a => a.mimeType === 'application/pdf')

  const afterQuoteImages = afterQuoteAttachments.filter(a => a.mimeType.startsWith('image/'))
  const afterQuotePdfs = afterQuoteAttachments.filter(a => a.mimeType === 'application/pdf')

  const persistentImages = persistentAttachments.filter(a => a.mimeType.startsWith('image/'))
  const persistentPdfs = persistentAttachments.filter(a => a.mimeType === 'application/pdf')

  const endImages = endAttachments.filter(a => a.mimeType.startsWith('image/'))
  const endPdfs = endAttachments.filter(a => a.mimeType === 'application/pdf')

  const hasPdfAttachments = beginningPdfs.length > 0 || afterQuotePdfs.length > 0 || persistentPdfs.length > 0 || endPdfs.length > 0

  // Helper function to add image attachments to a jsPDF instance
  async function addImageAttachments(pdf: jsPDF, images: QuoteAttachment[], addPageFirst: boolean = true) {
    for (let i = 0; i < images.length; i++) {
      if (addPageFirst || i > 0) {
        pdf.addPage()
      }
      await addAttachmentPage(pdf, images[i], quoteData.project.id)
    }
  }

  // If no PDF attachments, we can build everything with jsPDF alone
  if (!hasPdfAttachments) {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    })

    // 1. Beginning image attachments
    if (beginningImages.length > 0) {
      await addAttachmentPage(pdf, beginningImages[0], quoteData.project.id)
      for (let i = 1; i < beginningImages.length; i++) {
        pdf.addPage()
        await addAttachmentPage(pdf, beginningImages[i], quoteData.project.id)
      }
      pdf.addPage()
    }

    // 2. Quote page
    await addQuotePage(pdf, quoteData)

    // 3. After-quote image attachments
    await addImageAttachments(pdf, afterQuoteImages, true)

    // 4. Persistent document image attachments (product docs, global pages)
    await addImageAttachments(pdf, persistentImages, true)

    // 5. End image attachments
    await addImageAttachments(pdf, endImages, true)

    return Buffer.from(pdf.output('arraybuffer'))
  }

  // We have PDF attachments, so we need to use pdf-lib to merge everything
  try {
    // Helper function to merge a single PDF attachment
    async function mergePdfAttachment(attachment: QuoteAttachment, targetPdf: PDFDocument) {
      const attachmentBuffer = await getAttachmentBuffer(attachment, quoteData.project.id)

      if (!attachmentBuffer) {
        console.error(`PDF attachment not found for: ${attachment.filename}`)
        // Add a placeholder page for the missing PDF
        const placeholderPdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'letter'
        })
        placeholderPdf.setFontSize(12)
        placeholderPdf.setFont('helvetica', 'bold')
        placeholderPdf.text(attachment.description || attachment.originalName,
          placeholderPdf.internal.pageSize.getWidth() / 2, 20, { align: 'center' })
        placeholderPdf.setFontSize(10)
        placeholderPdf.setTextColor(150, 150, 150)
        placeholderPdf.text('PDF attachment not found',
          placeholderPdf.internal.pageSize.getWidth() / 2,
          placeholderPdf.internal.pageSize.getHeight() / 2,
          { align: 'center' })

        const placeholderBytes = placeholderPdf.output('arraybuffer')
        const placeholderPdfDoc = await PDFDocument.load(placeholderBytes)
        const pages = await targetPdf.copyPages(placeholderPdfDoc, placeholderPdfDoc.getPageIndices())
        return pages
      }

      try {
        const attachmentPdf = await PDFDocument.load(attachmentBuffer)
        const pages = await targetPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices())
        return pages
      } catch (error) {
        console.error(`Error loading PDF attachment ${attachment.filename}:`, error)
        // Add error placeholder page
        const errorPdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'letter'
        })
        errorPdf.setFontSize(12)
        errorPdf.setFont('helvetica', 'bold')
        errorPdf.text(attachment.description || attachment.originalName,
          errorPdf.internal.pageSize.getWidth() / 2, 20, { align: 'center' })
        errorPdf.setFontSize(10)
        errorPdf.setTextColor(200, 50, 50)
        errorPdf.text('Error loading PDF attachment',
          errorPdf.internal.pageSize.getWidth() / 2,
          errorPdf.internal.pageSize.getHeight() / 2,
          { align: 'center' })

        const errorBytes = errorPdf.output('arraybuffer')
        const errorPdfDoc = await PDFDocument.load(errorBytes)
        const pages = await targetPdf.copyPages(errorPdfDoc, errorPdfDoc.getPageIndices())
        return pages
      }
    }

    // Helper to add image attachments to pdf-lib document
    async function addImagesToPdfLib(images: QuoteAttachment[], targetPdf: PDFDocument) {
      if (images.length === 0) return

      const imagesPdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      })

      await addAttachmentPage(imagesPdf, images[0], quoteData.project.id)
      for (let i = 1; i < images.length; i++) {
        imagesPdf.addPage()
        await addAttachmentPage(imagesPdf, images[i], quoteData.project.id)
      }

      const imagesBytes = imagesPdf.output('arraybuffer')
      const imagesPdfDoc = await PDFDocument.load(imagesBytes)
      const pages = await targetPdf.copyPages(imagesPdfDoc, imagesPdfDoc.getPageIndices())
      pages.forEach(page => targetPdf.addPage(page))
    }

    // Create the final PDF document
    let finalPdf = await PDFDocument.create()

    // 1. Beginning attachments (images first, then PDFs)
    await addImagesToPdfLib(beginningImages, finalPdf)
    for (const attachment of beginningPdfs) {
      const pages = await mergePdfAttachment(attachment, finalPdf)
      pages.forEach(page => finalPdf.addPage(page))
    }

    // 2. Quote page
    const quotePdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    })
    await addQuotePage(quotePdf, quoteData)
    const quoteBytes = quotePdf.output('arraybuffer')
    const quotePdfDoc = await PDFDocument.load(quoteBytes)
    const quotePages = await finalPdf.copyPages(quotePdfDoc, quotePdfDoc.getPageIndices())
    quotePages.forEach(page => finalPdf.addPage(page))

    // 3. After-quote attachments (images first, then PDFs)
    await addImagesToPdfLib(afterQuoteImages, finalPdf)
    for (const attachment of afterQuotePdfs) {
      const pages = await mergePdfAttachment(attachment, finalPdf)
      pages.forEach(page => finalPdf.addPage(page))
    }

    // 4. Persistent documents - product docs / global pages (images first, then PDFs)
    await addImagesToPdfLib(persistentImages, finalPdf)
    for (const attachment of persistentPdfs) {
      const pages = await mergePdfAttachment(attachment, finalPdf)
      pages.forEach(page => finalPdf.addPage(page))
    }

    // 5. End attachments (images first, then PDFs)
    await addImagesToPdfLib(endImages, finalPdf)
    for (const attachment of endPdfs) {
      const pages = await mergePdfAttachment(attachment, finalPdf)
      pages.forEach(page => finalPdf.addPage(page))
    }

    // Save and return the merged PDF
    const mergedBytes = await finalPdf.save()
    return Buffer.from(mergedBytes)
  } catch (error) {
    console.error('Error merging PDF attachments:', error)
    // Fall back to a simple PDF with just the quote
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    })
    await addQuotePage(pdf, quoteData)
    return Buffer.from(pdf.output('arraybuffer'))
  }
}

/**
 * Helper function to get attachment buffer from GCS or filesystem
 */
async function getAttachmentBuffer(
  attachment: QuoteAttachment & { isPersistent?: boolean },
  projectId: number
): Promise<Buffer | null> {
  try {
    if (attachment.isPersistent) {
      // Persistent quote documents are stored locally in /uploads/quote-documents/[docId]/[filename]
      const localPath = path.join(
        process.cwd(),
        'public',
        'uploads',
        'quote-documents',
        String(attachment.id),
        attachment.filename
      )
      if (fs.existsSync(localPath)) {
        return fs.readFileSync(localPath)
      }
      return null
    } else {
      // Project-specific attachments are stored in GCS
      const gcsPath = `quote-attachments/${projectId}/${attachment.filename}`
      return await downloadFile(gcsPath)
    }
  } catch (error) {
    console.error('Error getting attachment buffer:', error)
    return null
  }
}

/**
 * Adds the main quote page with project info and line items
 */
async function addQuotePage(pdf: jsPDF, quoteData: QuoteData): Promise<void> {
  const pageWidth = pdf.internal.pageSize.getWidth() // 215.9mm for letter
  const pageHeight = pdf.internal.pageSize.getHeight() // 279.4mm for letter

  // Header section - Project name on left, logo and date on right
  let headerY = 15
  const logoMaxWidth = 40 // Maximum logo width in mm
  const logoMaxHeight = 15 // Maximum logo height in mm
  let logoActualHeight = 0

  // Right side: Company logo above the date
  if (!quoteData.companyLogo) {
    // Debug: Show if companyLogo is not set
    pdf.setFontSize(6)
    pdf.setTextColor(255, 0, 0)
    pdf.text('No companyLogo in data', pageWidth - 60, headerY)
    pdf.setTextColor(0, 0, 0)
  }
  if (quoteData.companyLogo) {
    try {
      // Parse the logo data - it's now stored as JSON with GCS path
      let logoBuffer: Buffer | null = null
      let logoMimeType = 'image/png'

      console.log('[PDF Logo] Starting logo processing, companyLogo:', quoteData.companyLogo.substring(0, 100))

      try {
        const logoInfo = JSON.parse(quoteData.companyLogo)
        console.log('[PDF Logo] Parsed logo info:', JSON.stringify(logoInfo))

        if (logoInfo.gcsPath) {
          // Download directly from GCS (same as UI endpoint does)
          console.log('[PDF Logo] Downloading from GCS path:', logoInfo.gcsPath)
          logoBuffer = await downloadFile(logoInfo.gcsPath)
          logoMimeType = logoInfo.mimeType || 'image/png'
          console.log('[PDF Logo] Downloaded successfully, buffer size:', logoBuffer.length, 'mimeType:', logoMimeType)
        } else {
          console.log('[PDF Logo] No gcsPath in logoInfo')
        }
      } catch (parseError) {
        console.log('[PDF Logo] JSON parse failed, trying legacy filesystem path. Error:', parseError)
        // Legacy format - try filesystem (will be removed after migration)
        const logoPath = path.join(process.cwd(), 'uploads', 'branding', quoteData.companyLogo)
        if (fs.existsSync(logoPath)) {
          logoBuffer = fs.readFileSync(logoPath)
          const logoExt = path.extname(quoteData.companyLogo).toLowerCase()
          logoMimeType = logoExt === '.svg' ? 'image/svg+xml' :
                        logoExt === '.jpg' || logoExt === '.jpeg' ? 'image/jpeg' : 'image/png'
          console.log('[PDF Logo] Loaded from filesystem, buffer size:', logoBuffer.length)
        } else {
          console.log('[PDF Logo] Legacy file not found at:', logoPath)
        }
      }

      if (!logoBuffer) {
        // Debug: Add visible text if logo failed to load
        pdf.setFontSize(6)
        pdf.setTextColor(255, 0, 0)
        pdf.text('Logo load failed', pageWidth - 60, headerY)
        pdf.setTextColor(0, 0, 0)
      }

      if (logoBuffer) {
        console.log('[PDF Logo] Processing logo buffer, size:', logoBuffer.length)
        const logoExt = logoMimeType.split('/')[1]
        console.log('[PDF Logo] Logo extension:', logoExt)

        // Resize logo to reasonable dimensions for PDF (max 600px width for good print quality)
        // This dramatically reduces file size while maintaining visual quality
        let processedLogoBuffer: Buffer
        let imageFormat: 'PNG' | 'JPEG' = 'PNG'

        if (logoExt === 'svg+xml' || logoExt === 'svg') {
          // SVG logos don't need resizing
          console.log('[PDF Logo] SVG detected, skipping resize')
          processedLogoBuffer = logoBuffer
        } else {
          // Resize raster images (PNG, JPG) to max 600px width, maintaining aspect ratio
          // Convert to JPEG for better compression (unless it has transparency)
          console.log('[PDF Logo] Getting sharp metadata...')
          const metadata = await sharp(logoBuffer).metadata()
          console.log('[PDF Logo] Metadata:', JSON.stringify(metadata))
          const hasAlpha = metadata.channels === 4

          if (hasAlpha) {
            // Keep PNG for images with transparency, but resize
            console.log('[PDF Logo] Has alpha, resizing as PNG...')
            processedLogoBuffer = await sharp(logoBuffer)
              .resize(600, 200, { fit: 'inside', withoutEnlargement: true })
              .png({ compressionLevel: 9 })
              .toBuffer()
          } else {
            // Convert to JPEG for smaller size
            console.log('[PDF Logo] No alpha, converting to JPEG...')
            processedLogoBuffer = await sharp(logoBuffer)
              .resize(600, 200, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 85 })
              .toBuffer()
            imageFormat = 'JPEG'
          }
          console.log('[PDF Logo] Processed buffer size:', processedLogoBuffer.length)
        }

        // Get actual dimensions after processing to calculate aspect ratio
        const processedMetadata = await sharp(processedLogoBuffer).metadata()
        const imgWidth = processedMetadata.width || 600
        const imgHeight = processedMetadata.height || 200
        console.log('[PDF Logo] Final dimensions:', imgWidth, 'x', imgHeight)

        // Calculate scaled dimensions preserving aspect ratio
        const aspectRatio = imgWidth / imgHeight
        let finalWidth = logoMaxWidth
        let finalHeight = logoMaxWidth / aspectRatio

        // If height exceeds max, scale down based on height instead
        if (finalHeight > logoMaxHeight) {
          finalHeight = logoMaxHeight
          finalWidth = logoMaxHeight * aspectRatio
        }

        const logoBase64 = processedLogoBuffer.toString('base64')
        const finalMimeType = imageFormat === 'JPEG' ? 'image/jpeg' :
                         (logoExt === 'svg+xml' || logoExt === 'svg' ? 'image/svg+xml' : 'image/png')
        const logoData = `data:${finalMimeType};base64,${logoBase64}`
        console.log('[PDF Logo] Adding image to PDF, format:', imageFormat, 'dimensions:', finalWidth, 'x', finalHeight)

        // Position logo in top right, above where date will be
        const logoX = pageWidth - 20 - finalWidth
        pdf.addImage(logoData, imageFormat,
          logoX, headerY, finalWidth, finalHeight, undefined, 'SLOW')
        logoActualHeight = finalHeight
        console.log('[PDF Logo] Successfully added logo to PDF')
      } else {
        console.log('[PDF Logo] No logo buffer available')
      }
    } catch (error) {
      console.log('[PDF Logo] ERROR adding company logo to PDF:', error)
      // Debug: Show error in PDF
      pdf.setFontSize(6)
      pdf.setTextColor(255, 0, 0)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      pdf.text(`Logo error: ${errorMsg.substring(0, 50)}`, pageWidth - 80, headerY)
      pdf.setTextColor(0, 0, 0)
    }
  }

  // Left: Project name (bold, larger) - 15mm margin to match cards
  const projectNameY = logoActualHeight > 0 ? headerY + 5 : headerY + 5
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.text(quoteData.project.name, 15, projectNameY)

  // Customer info below project name
  let customerY = projectNameY + 6
  if (quoteData.customer) {
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(60, 60, 60)

    // Company name
    pdf.text(quoteData.customer.companyName, 15, customerY)
    customerY += 4.5

    // Contact name (if present)
    if (quoteData.customer.contactName) {
      pdf.text(quoteData.customer.contactName, 15, customerY)
      customerY += 4.5
    }

    // Address line (if present)
    if (quoteData.customer.address) {
      pdf.text(quoteData.customer.address, 15, customerY)
      customerY += 4.5
    }

    // City, State ZIP (if present)
    const cityStateZip = [
      quoteData.customer.city,
      quoteData.customer.state,
      quoteData.customer.zip
    ].filter(Boolean).join(', ')
    if (cityStateZip) {
      pdf.text(cityStateZip, 15, customerY)
      customerY += 4.5
    }

    // Phone (if present)
    if (quoteData.customer.phone) {
      pdf.text(quoteData.customer.phone, 15, customerY)
      customerY += 4.5
    }

    // Email (if present)
    if (quoteData.customer.email) {
      pdf.text(quoteData.customer.email, 15, customerY)
      customerY += 4.5
    }

    pdf.setTextColor(0, 0, 0)
  }

  // Calculate divider position - below left content and logo
  const rightContentBottom = logoActualHeight > 0 ? headerY + logoActualHeight + 4 : headerY
  const dividerY = Math.max(customerY, rightContentBottom) + 2

  // Divider line - matches card width (15mm margins)
  pdf.setLineWidth(0.33)
  pdf.setDrawColor(200, 200, 200)
  pdf.line(15, dividerY, pageWidth - 15, dividerY)

  // Quote items table - now returns the page number where it ended
  const tableStartY = dividerY + 10
  await addQuoteItemsTable(pdf, quoteData, tableStartY)

  // Footer with totals - will be added on the last page by addQuoteItemsTable
}

/**
 * Adds the quote items table with elevation images
 * Cards display text content on left and elevation images on right
 * Uses pagination: max 3 items per page, with footer on the last page
 */
/**
 * Calculates the required card height based on content
 * Base height covers: name, description, dimensions, options header, glass, color
 * Dynamic height adds: 3.5mm per additional hardware item
 */
function calculateCardHeight(item: QuoteItem): number {
  const baseHeight = 32 // Fixed content: name, description, dimensions, options header, glass type, color
  const hardwareItems = item.hardware && item.hardware !== 'Standard' && item.hardware.trim() !== ''
    ? item.hardware.split(' • ').length
    : 0
  const optionsHeight = hardwareItems * 3.5
  const minHeight = 48 // Maintain minimum for image area
  return Math.max(minHeight, baseHeight + optionsHeight + 8) // +8 for bottom padding
}

async function addQuoteItemsTable(
  pdf: jsPDF,
  quoteData: QuoteData,
  startY: number
): Promise<void> {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const marginX = 15 // Reduced from 20mm to maximize width for portrait layout
  const cellPadding = 5
  const minCardHeight = 48 // Minimum height for each opening card
  const cardSpacing = 4 // Space between cards (reduced from 6mm)
  const footerHeight = 63 // Space needed for footer with pricing (matches actual footer height)
  const ITEMS_PER_PAGE = 4 // Maximum items per page
  const cardWidth = pageWidth - 2 * marginX
  const cornerRadius = 3 // Rounded corner radius
  const elevationAreaWidth = cardWidth * 0.55 // Width allocated for elevation images (55% of card width)
  const textContentWidth = cardWidth - elevationAreaWidth - cellPadding // Width for text content on left

  const totalItems = quoteData.quoteItems.length
  let currentY = startY

  // Pre-calculate heights for all items
  const itemHeights = quoteData.quoteItems.map(item => calculateCardHeight(item))

  // Pre-calculate page assignments for all items using actual heights
  interface PageAssignment {
    pageItems: number[]
    includeFooter: boolean
  }

  // Continuation header height (matches addContinuationHeader: headerY=15 + 12 = 27)
  const continuationHeaderEndY = 27

  const assignItemsToPages = (): PageAssignment[] => {
    const pages: PageAssignment[] = []
    let itemIndex = 0
    let isFirstPage = true

    while (itemIndex < totalItems) {
      // First page starts after main header; continuation pages start after continuation header
      const pageStartY = isFirstPage ? startY : continuationHeaderEndY
      const pageItems: number[] = []
      let currentPageHeight = 0
      const availableHeightWithFooter = pageHeight - pageStartY - 10 - footerHeight
      const availableHeightWithoutFooter = pageHeight - pageStartY - 10

      // Try to fit items on this page
      while (itemIndex + pageItems.length < totalItems) {
        const nextItemIndex = itemIndex + pageItems.length
        const nextItemHeight = itemHeights[nextItemIndex] + cardSpacing
        const remainingItemsAfterThis = totalItems - nextItemIndex - 1

        // Check if we can fit this item
        // If this could be the last page (no remaining items after), use footer height
        // Otherwise, use full height
        const needsFooterSpace = remainingItemsAfterThis === 0
        const availableHeight = needsFooterSpace ? availableHeightWithFooter : availableHeightWithoutFooter

        if (currentPageHeight + nextItemHeight <= availableHeight) {
          pageItems.push(nextItemIndex)
          currentPageHeight += nextItemHeight
        } else {
          // Can't fit more items on this page
          break
        }

        // Limit items per page
        if (pageItems.length >= ITEMS_PER_PAGE) break
      }

      // Ensure we place at least one item per page (unless we're out of items)
      if (pageItems.length === 0 && itemIndex < totalItems) {
        pageItems.push(itemIndex)
      }

      const isLastPage = itemIndex + pageItems.length >= totalItems
      pages.push({
        pageItems,
        includeFooter: isLastPage
      })

      itemIndex += pageItems.length
      isFirstPage = false
    }
    return pages
  }

  const pageAssignments = assignItemsToPages()
  const totalPages = pageAssignments.length

  // Process items page by page
  for (let pageIndex = 0; pageIndex < pageAssignments.length; pageIndex++) {
    const pageAssignment = pageAssignments[pageIndex]
    const isFirstPage = pageIndex === 0
    const pageNumber = pageIndex + 1

    // Add new page if not the first page
    if (!isFirstPage) {
      pdf.addPage()
      // Add continuation header with project name
      currentY = addContinuationHeader(pdf, quoteData.project.name)
    }

    // Process each item on this page
    for (const itemIndex of pageAssignment.pageItems) {
      const item = quoteData.quoteItems[itemIndex]
      const cardHeight = itemHeights[itemIndex] // Use pre-calculated dynamic height for this item

    // Draw card with rounded corners and grey background (no outline)
    pdf.setFillColor(243, 244, 246) // bg-gray-100
    pdf.roundedRect(marginX, currentY, cardWidth, cardHeight, cornerRadius, cornerRadius, 'F')

    let contentY = currentY + cellPadding + 4

    // Opening name as header with dimensions (bold, larger font)
    // Format: "Opening Name | 48" W × 96" H"
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    const nameWithSize = `${item.name} | ${item.dimensions}`
    pdf.text(nameWithSize, marginX + cellPadding, contentY)
    const nameWidth = pdf.getTextWidth(nameWithSize) // Measure while still at font size 11

    // Price badge - professional pill style, same font size as title for visual balance
    const priceText = `$${item.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
    // Keep font size 11 to match title, measure width
    const priceTextWidth = pdf.getTextWidth(priceText)
    const horizontalPadding = 3 // 1.5mm padding on each side
    const priceWidth = priceTextWidth + horizontalPadding
    const badgeHeight = 5.5
    const badgeX = marginX + cellPadding + nameWidth + 3 // 3mm gap after dimensions
    const badgeY = contentY - 4 // Align with text baseline

    // Draw price badge - green style
    pdf.setFillColor(22, 163, 74) // Green-600
    pdf.roundedRect(badgeX, badgeY, priceWidth, badgeHeight, 1.5, 1.5, 'F') // Subtle rounded corners

    // Draw price text - white on green, centered vertically in badge
    pdf.setTextColor(255, 255, 255)
    pdf.text(priceText, badgeX + priceWidth / 2, badgeY + badgeHeight / 2 + 1.2, { align: 'center' })
    pdf.setTextColor(0, 0, 0)

    contentY += 5

    // Opening type (description - e.g., "1 Sliding Door") with direction after
    // Format: "1 Fixed Panel, 1 Swing Door (LO / RI)"
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(100, 100, 100)
    let descriptionText = item.description
    // Add opening directions after the component type description
    if (item.openingDirections && item.openingDirections.length > 0) {
      descriptionText += ` (${item.openingDirections.join(' / ')})`
    }
    pdf.text(descriptionText, marginX + cellPadding, contentY)
    pdf.setTextColor(0, 0, 0)
    contentY += 8

    // Options section - always show with glass type and color
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(70, 70, 70)
    pdf.text('Options:', marginX + cellPadding, contentY)
    contentY += 6

    // Helper to render option with bold label
    const renderOption = (label: string, value: string, y: number) => {
      pdf.setFont('helvetica', 'normal')
      pdf.text('• ', marginX + cellPadding + 2, y)
      const bulletWidth = pdf.getTextWidth('• ')
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${label}: `, marginX + cellPadding + 2 + bulletWidth, y)
      const labelWidth = pdf.getTextWidth(`${label}: `)
      pdf.setFont('helvetica', 'normal')
      pdf.text(value, marginX + cellPadding + 2 + bulletWidth + labelWidth, y)
    }

    // Glass type
    renderOption('Glass Type', item.glassType, contentY)
    contentY += 3.5

    // Extrusion color
    renderOption('Extrusion Color', item.color, contentY)
    contentY += 3.5

    // Additional hardware options
    if (item.hardware && item.hardware !== 'Standard' && item.hardware.trim() !== '') {
      const hardwareItems = item.hardware.split(' • ')
      for (const hwItem of hardwareItems) {
        const formattedItem = hwItem.replace(' | +', ' +').replace(' | STANDARD', '')
        // Parse "Category: Value" format
        const colonIndex = formattedItem.indexOf(':')
        if (colonIndex > -1) {
          const optLabel = formattedItem.substring(0, colonIndex).trim()
          const optValue = formattedItem.substring(colonIndex + 1).trim()
          renderOption(optLabel, optValue, contentY)
        } else {
          pdf.setFont('helvetica', 'normal')
          pdf.text(`• ${formattedItem}`, marginX + cellPadding + 2, contentY)
        }
        contentY += 3.5
      }
    }
    pdf.setTextColor(0, 0, 0)

    // Render images on the right side of the card
    // Use planViewImages if available (has metadata for proper positioning), otherwise fall back to elevationImages
    const hasImages = (item.planViewImages && item.planViewImages.length > 0) ||
                     (item.elevationImages && item.elevationImages.length > 0)

    if (hasImages) {
      const imageAreaX = marginX + textContentWidth + cellPadding
      const topPadding = 5 // Top padding
      const bottomPadding = 3 // Bottom padding
      const rightPadding = 4 // Extra padding on right side
      const imageAreaY = currentY + topPadding
      const imageAreaWidth = elevationAreaWidth - cellPadding * 2 - rightPadding
      const imageAreaHeight = cardHeight - topPadding - bottomPadding

      // Determine if we have plan view images with metadata (for wall drawing and positioning)
      const usePlanViewImages = item.planViewImages && item.planViewImages.length > 0
      // Determine if we have elevation view images with metadata (for proportional widths, no wall drawing)
      const useElevationViewImages = item.elevationViewImages && item.elevationViewImages.length > 0
      // Use either metadata source for width calculations
      const hasWidthMetadata = usePlanViewImages || useElevationViewImages

      // Calculate how to fit all images
      const numImages = usePlanViewImages ? item.planViewImages!.length :
                       useElevationViewImages ? item.elevationViewImages!.length :
                       item.elevationImages.length
      const imageSpacing = 0 // No gaps between components for continuous view

      // ===== TWO-PASS APPROACH (like DrawingViewer) =====
      // First pass: Process all images and get their PNG aspect ratios
      interface ProcessedImage {
        imageData: string
        imageFormat: 'PNG' | 'JPEG'
        scaledWidth: number
        scaledHeight: number
        aspectRatio: number | null
        isPlanView: boolean
        orientation?: string // 'bottom' or 'top' - from plan view metadata
        apiWidth?: number // Width from API (in inches)
        apiHeight?: number // Height from API (in inches)
      }

      // Intermediate structure to collect image data before scaling
      interface PreProcessedImage {
        imageData: string
        imageFormat: 'PNG' | 'JPEG'
        aspectRatio: number | null
        isPlanView: boolean
        orientation?: string
        apiWidth?: number
        apiHeight?: number
        wasConvertedFromSvg?: boolean // Track if this was originally an SVG
      }
      const preProcessedImages: PreProcessedImage[] = []

      // First pass: Process all images to get their PNG aspect ratios
      for (let imgIndex = 0; imgIndex < numImages; imgIndex++) {
        // Get image data and optional metadata (plan view or elevation view)
        const planViewData = usePlanViewImages ? item.planViewImages![imgIndex] : null
        const elevationViewData = useElevationViewImages ? item.elevationViewImages![imgIndex] : null
        const metadataSource = planViewData ?? elevationViewData
        const rawImageData = metadataSource ? metadataSource.imageData : item.elevationImages[imgIndex]

        try {
          let imageFormat: 'PNG' | 'JPEG' = 'PNG'
          let imageData = rawImageData
          let imageAspectRatio: number | null = null // height / width
          let wasConvertedFromSvg = false

          // Check if the image is SVG and needs conversion
          const isSvgData = rawImageData.startsWith('data:image/svg+xml') ||
            (rawImageData.startsWith('data:') === false &&
             Buffer.from(rawImageData.substring(0, 100), 'base64').toString('utf-8').includes('<svg'))

          if (isSvgData) {
            // SVG data - render to PNG first
            try {
              const svgString = decodeSvgData(rawImageData)

              // For SVGs, use the SVG viewBox aspect ratio to maintain natural proportions
              const svgDims = getSvgDimensions(svgString)
              if (svgDims) {
                imageAspectRatio = svgDims.height / svgDims.width
              }

              // Use moderate dimensions for quote display - balances quality vs file size
              const pngData = await renderSvgToPng(svgString, {
                width: 12,
                height: 28,
                background: '#f3f4f6',
                mode: usePlanViewImages ? 'plan' : 'elevation'
              })
              imageData = pngData
              wasConvertedFromSvg = true

              if (!imageAspectRatio) {
                imageAspectRatio = 28 / 12
              }
            } catch (svgError) {
              console.error(`Failed to render SVG to PNG for image ${imgIndex}:`, svgError)
              continue
            }
          } else if (rawImageData.startsWith('data:')) {
            if (rawImageData.includes('image/jpeg') || rawImageData.includes('image/jpg')) {
              imageFormat = 'JPEG'
            }
            imageData = rawImageData.split(',')[1] || rawImageData
            // Use API-provided aspect ratio for consistent sizing
            if (planViewData?.width && planViewData?.height) {
              imageAspectRatio = planViewData.height / planViewData.width
            } else {
              const pngDims = getPngDimensions(imageData)
              if (pngDims) {
                imageAspectRatio = pngDims.height / pngDims.width
              }
            }
          } else {
            // Prefer API-provided aspect ratio for raw base64 images as well
            if (metadataSource?.width && metadataSource?.height) {
              imageAspectRatio = metadataSource.height / metadataSource.width
            } else {
              const pngDims = getPngDimensions(rawImageData)
              if (pngDims) {
                imageAspectRatio = pngDims.height / pngDims.width
              }
            }
          }

          const isPlanView = usePlanViewImages || (imageAspectRatio !== null && imageAspectRatio < 1)

          preProcessedImages.push({
            imageData,
            imageFormat,
            aspectRatio: imageAspectRatio,
            isPlanView,
            orientation: planViewData?.orientation, // Only plan view has orientation
            apiWidth: metadataSource?.width,
            apiHeight: metadataSource?.height,
            wasConvertedFromSvg
          })
        } catch (imageError) {
          console.error(`Failed to process image ${imgIndex}:`, imageError)
        }
      }

      // Check if all images are PNG-only (no SVG conversions)
      const isPngOnly = preProcessedImages.length > 0 &&
        preProcessedImages.every(img => !img.wasConvertedFromSvg)

      // Second pass: Calculate uniform scale factor and apply scaling
      // For plan views, use API widths and API-based aspect ratios for consistent sizing
      let totalApiWidth = 0
      let maxActualHeight = 0

      if (hasWidthMetadata) {
        for (const img of preProcessedImages) {
          if (img.apiWidth) {
            totalApiWidth += img.apiWidth
            // Calculate height using API-provided aspect ratio
            if (img.aspectRatio !== null) {
              const actualHeight = img.apiWidth * img.aspectRatio
              if (actualHeight > maxActualHeight) maxActualHeight = actualHeight
            }
          }
        }
      }

      // Calculate uniform scale factor based on actual dimensions
      // Cap at 0.7 to create consistent sizing between single and multi-panel openings
      const rawScaleFactor = hasWidthMetadata && totalApiWidth > 0 && maxActualHeight > 0
        ? Math.min(imageAreaWidth / totalApiWidth, imageAreaHeight / maxActualHeight)
        : 1
      let uniformScaleFactor = Math.min(rawScaleFactor, 0.7)

      // Reduce PNG-only images by 25% (they tend to be larger/unscaled)
      if (isPngOnly) {
        uniformScaleFactor *= 0.75
      }

      // Apply scaling to create final processed images
      const processedImages: ProcessedImage[] = []

      for (const preImg of preProcessedImages) {
        let scaledWidth: number
        let scaledHeight: number

        // For images with API metadata, use uniform scale factor for WIDTH
        // and API-based aspect ratio for HEIGHT for consistent sizing
        if (hasWidthMetadata && preImg.apiWidth && preImg.aspectRatio !== null) {
          scaledWidth = preImg.apiWidth * uniformScaleFactor
          scaledHeight = scaledWidth * preImg.aspectRatio
        } else if (preImg.aspectRatio !== null) {
          // Fallback: use PNG aspect ratio for elevation images or when no API data
          const maxImageWidth = numImages > 1
            ? (imageAreaWidth - imageSpacing * (numImages - 1)) / numImages
            : imageAreaWidth
          const containerAspectRatio = imageAreaHeight / maxImageWidth

          if (preImg.aspectRatio > containerAspectRatio) {
            scaledHeight = imageAreaHeight
            scaledWidth = imageAreaHeight / preImg.aspectRatio
          } else {
            scaledWidth = maxImageWidth
            scaledHeight = maxImageWidth * preImg.aspectRatio
          }
        } else {
          // Default fallback
          scaledWidth = imageAreaWidth / numImages
          scaledHeight = imageAreaHeight
        }

        processedImages.push({
          imageData: preImg.imageData,
          imageFormat: preImg.imageFormat,
          scaledWidth,
          scaledHeight,
          aspectRatio: preImg.aspectRatio,
          isPlanView: preImg.isPlanView,
          orientation: preImg.orientation,
          apiWidth: preImg.apiWidth,
          apiHeight: preImg.apiHeight
        })
      }

      // Determine if this is a plan view assembly (using metadata or aspect ratio detection)
      const isPlanViewAssembly = usePlanViewImages ||
        (processedImages.length > 0 && processedImages.every(img => img.isPlanView))

      // Second pass: Calculate positions and render
      if (isPlanViewAssembly) {
        // Plan view assembly: align components using orientation metadata
        // Components with orientation='bottom' have their wall line at the bottom of their bounding box
        // Components with other orientation have their wall line at the top

        // Calculate total assembly width
        const totalWidth = processedImages.reduce((sum, img) => sum + img.scaledWidth, 0)

        // Calculate the bounding box considering orientation
        // For orientation='bottom': wall line at bottom, content extends above
        // For other: wall line at top, content extends below
        let maxAboveBaseline = 0  // Max height above the wall line
        let maxBelowBaseline = 0  // Max height below the wall line

        for (const img of processedImages) {
          if (img.orientation === 'bottom') {
            // Wall line at bottom, entire image height is above baseline
            maxAboveBaseline = Math.max(maxAboveBaseline, img.scaledHeight)
          } else {
            // Wall line at top, entire image height is below baseline
            maxBelowBaseline = Math.max(maxBelowBaseline, img.scaledHeight)
          }
        }

        // Total assembly height from top to bottom
        const totalHeight = maxAboveBaseline + maxBelowBaseline

        // Right-align the assembly within the available area
        const assemblyOffsetX = imageAreaWidth - totalWidth
        const assemblyOffsetY = (imageAreaHeight - totalHeight) / 2

        // The baseline Y position (where wall lines align)
        const baselineY = imageAreaY + assemblyOffsetY + maxAboveBaseline

        let imgX = imageAreaX + assemblyOffsetX

        for (const img of processedImages) {
          // Calculate Y position based on orientation
          let imgY: number
          if (img.orientation === 'bottom') {
            // Wall line at bottom of image, image extends ABOVE baseline
            imgY = baselineY - img.scaledHeight
          } else {
            // Wall line at top of image, image extends BELOW baseline
            imgY = baselineY
          }

          try {
            pdf.addImage(
              img.imageData,
              img.imageFormat,
              imgX,
              imgY,
              img.scaledWidth,
              img.scaledHeight,
              undefined,
              'SLOW'
            )
          } catch (imageError) {
            console.error('Failed to add plan view image:', imageError)
          }

          imgX += img.scaledWidth + imageSpacing
        }

        // === DRAW WALLS ON LEFT AND RIGHT SIDES ===
        // Fixed wall dimensions for consistent appearance across all plan views
        // 30px wide x 10px tall (converted to mm: ~7.9mm x ~2.6mm)
        const wallLength = 7.9    // 30px width
        const wallThickness = 2.6 // 10px height

        // Calculate assembly boundaries
        const assemblyLeftX = imageAreaX + assemblyOffsetX
        const assemblyRightX = assemblyLeftX + totalWidth

        // Determine wall Y position based on component orientation
        // For 'bottom' orientation: components sit above baseline, wall bottom aligns with baseline
        // For 'top' orientation: components sit below baseline, wall top aligns with baseline
        const primaryOrientation = processedImages[0]?.orientation || 'bottom'
        const wallY = primaryOrientation === 'bottom'
          ? baselineY - wallThickness  // Wall bottom at baseline (component sits above)
          : baselineY                   // Wall top at baseline (component sits below)

        // Draw left wall (extends to the left of the assembly)
        drawHatchedWall(
          pdf,
          assemblyLeftX - wallLength,
          wallY,
          wallLength,
          wallThickness,
          1.2 // Hatch spacing
        )

        // Draw right wall (extends to the right of the assembly)
        drawHatchedWall(
          pdf,
          assemblyRightX,
          wallY,
          wallLength,
          wallThickness,
          1.2 // Hatch spacing
        )
      } else {
        // Elevation view or mixed: center all images as a group, then place edge-to-edge

        // Calculate total scaled width of all images
        const totalScaledWidth = processedImages.reduce((sum, img) => sum + img.scaledWidth, 0)

        // Calculate the maximum height for vertical centering
        const maxScaledHeight = Math.max(...processedImages.map(img => img.scaledHeight))

        // Start position to center the entire group horizontally
        let imgX = imageAreaX + (imageAreaWidth - totalScaledWidth) / 2

        // Vertical centering offset
        const groupOffsetY = (imageAreaHeight - maxScaledHeight) / 2

        for (const img of processedImages) {
          // Center each image vertically within the max height
          const individualOffsetY = (maxScaledHeight - img.scaledHeight) / 2

          try {
            pdf.addImage(
              img.imageData,
              img.imageFormat,
              imgX,
              imageAreaY + groupOffsetY + individualOffsetY,
              img.scaledWidth,
              img.scaledHeight,
              undefined,
              'SLOW'
            )
          } catch (imageError) {
            console.error('Failed to add elevation image:', imageError)
          }

          // Move to the next image position (edge-to-edge, no gap)
          imgX += img.scaledWidth
        }
      }
    }

      currentY += cardHeight + cardSpacing
    } // End of inner loop (items on this page)

    // Add appropriate footer based on whether this is the last page
    if (pageAssignment.includeFooter) {
      // Last page gets the full pricing footer
      addQuoteFooter(pdf, quoteData)
    } else {
      // Intermediate pages get a simple footer with date and page number
      addSimplePageFooter(pdf, pageNumber, totalPages)
    }
  } // End of outer loop (pages)
}

/**
 * Adds the footer with pricing totals, valid until, and terms
 */
function addQuoteFooter(pdf: jsPDF, quoteData: QuoteData): void {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const contentPadding = 20 // Padding for content inside the footer
  const footerHeight = 63 // Height of the footer area (~2.5 inches)
  const footerY = pageHeight - footerHeight // Footer starts here and goes to bottom

  // Background for footer - full width, touches bottom
  pdf.setFillColor(248, 248, 248)
  pdf.rect(0, footerY, pageWidth, footerHeight, 'F')

  // Pricing breakdown on the right side
  const priceX = pageWidth - 80
  let priceY = footerY + 14

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')

  // Subtotal
  pdf.text('Subtotal:', priceX, priceY)
  pdf.text(`$${quoteData.adjustedSubtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
    pageWidth - contentPadding, priceY, { align: 'right' })
  priceY += 7

  // Installation (always show, TBD if 0)
  pdf.text('Installation:', priceX, priceY)
  const installationText = quoteData.installationCost > 0
    ? `$${quoteData.installationCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
    : 'TBD'
  pdf.text(installationText, pageWidth - contentPadding, priceY, { align: 'right' })
  priceY += 7

  // Tax (always show, TBD if 0)
  pdf.text('Tax:', priceX, priceY)
  const taxText = quoteData.taxRate > 0
    ? `$${quoteData.taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
    : 'TBD'
  pdf.text(taxText, pageWidth - contentPadding, priceY, { align: 'right' })
  priceY += 7

  // Separator line before total
  priceY += 2
  pdf.setLineWidth(0.3)
  pdf.setDrawColor(180, 180, 180)
  pdf.line(priceX - 5, priceY, pageWidth - contentPadding, priceY)
  priceY += 6

  // Total as normal text
  const totalText = `$${quoteData.totalPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(0, 0, 0)
  pdf.text('Total:', priceX, priceY)
  pdf.text(totalText, pageWidth - contentPadding, priceY, { align: 'right' })

  // Left side - Valid Until and Terms
  let leftY = footerY + 14

  // Valid Until
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(60, 60, 60)
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 30)
  pdf.text(`Valid Until: ${validUntil.toLocaleDateString()}`, contentPadding, leftY)
  leftY += 8

  // Terms placeholder
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(100, 100, 100)
  const termsText = 'Terms & Conditions: This quote is subject to final measurements and site verification. ' +
    'Prices may vary based on actual conditions. Payment terms and delivery schedule to be confirmed upon order. ' +
    'Please contact us with any questions.'
  const termsLines = pdf.splitTextToSize(termsText, pageWidth - 2 * contentPadding - 90) // Leave room for pricing on right
  pdf.text(termsLines, contentPadding, leftY)

  // Date at the bottom left
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(100, 100, 100)
  pdf.text(new Date().toLocaleDateString(), contentPadding, pageHeight - 5)

  pdf.setTextColor(0, 0, 0)
}

/**
 * Adds an attachment page (image or PDF)
 */
async function addAttachmentPage(
  pdf: jsPDF,
  attachment: QuoteAttachment & { isPersistent?: boolean },
  projectId: number
): Promise<void> {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const marginX = 20
  const marginY = 20

  // Add attachment title/description at top
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  let currentY = marginY

  const displayName = attachment.description || attachment.originalName
  pdf.text(displayName, pageWidth / 2, currentY, { align: 'center' })
  currentY += 10

  // Get attachment buffer from GCS or filesystem
  const attachmentBuffer = await getAttachmentBuffer(attachment, projectId)

  if (!attachmentBuffer) {
    console.error(`Attachment file not found: ${attachment.filename}`)
    pdf.setFontSize(10)
    pdf.setTextColor(150, 150, 150)
    pdf.text('Attachment file not found', pageWidth / 2, pageHeight / 2, { align: 'center' })
    pdf.setTextColor(0, 0, 0)
    return
  }

  // Handle different file types
  if (attachment.mimeType.startsWith('image/')) {
    await addImageAttachmentFromBuffer(pdf, attachmentBuffer, attachment.mimeType, currentY, pageWidth, pageHeight, marginX, marginY)
  } else if (attachment.mimeType === 'application/pdf') {
    // For PDF attachments, we'll add a note and handle embedding in the future
    // For now, just indicate that a PDF spec sheet is included
    pdf.setFontSize(10)
    pdf.setTextColor(100, 100, 100)
    pdf.text('PDF Specification Sheet', pageWidth / 2, pageHeight / 2, { align: 'center' })
    pdf.setFontSize(8)
    pdf.text('(PDF embedding coming soon)', pageWidth / 2, pageHeight / 2 + 7, { align: 'center' })
    pdf.setTextColor(0, 0, 0)
  }
}

/**
 * Adds an image attachment to the PDF from a buffer
 */
async function addImageAttachmentFromBuffer(
  pdf: jsPDF,
  imageBuffer: Buffer,
  mimeType: string,
  startY: number,
  pageWidth: number,
  pageHeight: number,
  marginX: number,
  marginY: number
): Promise<void> {
  try {
    const imageBase64 = imageBuffer.toString('base64')
    const imageType = mimeType.split('/')[1].toUpperCase()

    // Determine image format for jsPDF
    let format: 'PNG' | 'JPEG' | 'JPG' = 'PNG'
    if (imageType === 'JPEG' || imageType === 'JPG') {
      format = 'JPEG'
    }

    const imageData = `data:${mimeType};base64,${imageBase64}`

    // Calculate image dimensions to fit page
    const availableWidth = pageWidth - 2 * marginX
    const availableHeight = pageHeight - startY - marginY

    // Get image properties (we'll use the available space for now)
    // In a real implementation, you'd want to get actual image dimensions
    const imgWidth = availableWidth
    const imgHeight = availableHeight

    // Center image on page
    const imgX = marginX
    const imgY = startY

    pdf.addImage(imageData, format, imgX, imgY, imgWidth, imgHeight)
  } catch (error) {
    console.error('Error adding image attachment:', error)
    pdf.setFontSize(10)
    pdf.setTextColor(150, 150, 150)
    pdf.text('Error loading image', pageWidth / 2, pageHeight / 2, { align: 'center' })
    pdf.setTextColor(0, 0, 0)
  }
}

/**
 * Helper function to add a continuation page header (for pages after the first)
 * Returns the Y position where content should start
 */
function addContinuationHeader(
  pdf: jsPDF,
  projectName: string
): number {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const headerY = 15

  // Project name on the left
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(0, 0, 0)
  pdf.text(projectName, 15, headerY)

  // "Continued" text on the right in gray
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(120, 120, 120)
  pdf.text('(continued)', pageWidth - 15, headerY, { align: 'right' })

  // Light separator line
  pdf.setLineWidth(0.3)
  pdf.setDrawColor(200, 200, 200)
  pdf.line(15, headerY + 4, pageWidth - 15, headerY + 4)

  // Reset text color
  pdf.setTextColor(0, 0, 0)

  // Return the Y position where content should start (below the header)
  return headerY + 12
}

/**
 * Helper function to add a simple page footer (date and page number)
 * Used on pages that don't have the full pricing footer
 */
function addSimplePageFooter(
  pdf: jsPDF,
  pageNum: number,
  totalPages: number
): void {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const footerY = pageHeight - 10

  // Footer text
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(120, 120, 120)

  // Left: Date
  const dateText = new Date().toLocaleDateString()
  pdf.text(dateText, 15, footerY)

  // Right: Page number
  pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 15, footerY, { align: 'right' })

  // Reset text color
  pdf.setTextColor(0, 0, 0)
}

/**
 * Helper function to add a standard page footer
 */
function addPageFooter(
  pdf: jsPDF,
  projectName: string,
  pageNum?: number
): void {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const footerY = pageHeight - 12

  // Line separator
  pdf.setLineWidth(0.3)
  pdf.setDrawColor(150, 150, 150)
  pdf.line(15, footerY - 5, pageWidth - 15, footerY - 5)

  // Footer text
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(100, 100, 100)

  // Left: Project name
  pdf.text(projectName, 15, footerY)

  // Right: Date and page number
  const dateText = new Date().toLocaleDateString()
  const currentPage = pageNum || pdf.getCurrentPageInfo().pageNumber
  pdf.text(`${dateText} | Page ${currentPage}`, pageWidth - 15, footerY, { align: 'right' })

  // Reset text color
  pdf.setTextColor(0, 0, 0)
}
