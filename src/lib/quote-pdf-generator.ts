// Quote PDF Generation Utility
// Uses jsPDF to create professional quote PDFs with optional attachments
// Uses pdf-lib to merge PDF attachments

import { jsPDF } from 'jspdf'
import { PDFDocument } from 'pdf-lib'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { renderSvgToPng, decodeSvgData } from './svg-renderer'

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
  planViewImages?: PlanViewImage[] // For plan view with metadata
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
      const attachmentPath = resolveAttachmentPath(attachment, quoteData.project.id)

      if (!fs.existsSync(attachmentPath)) {
        console.error(`PDF attachment not found: ${attachmentPath}`)
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
        const attachmentBytes = await fs.promises.readFile(attachmentPath)
        const attachmentPdf = await PDFDocument.load(attachmentBytes)
        const pages = await targetPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices())
        return pages
      } catch (error) {
        console.error(`Error loading PDF attachment ${attachmentPath}:`, error)
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
 * Helper function to resolve the filesystem path for an attachment
 */
function resolveAttachmentPath(
  attachment: QuoteAttachment & { isPersistent?: boolean },
  projectId: number
): string {
  if (attachment.isPersistent) {
    // Persistent quote documents are stored in /uploads/quote-documents/[docId]/[filename]
    return path.join(
      process.cwd(),
      'public',
      'uploads',
      'quote-documents',
      String(attachment.id),
      attachment.filename
    )
  } else {
    // Project-specific attachments are stored in /uploads/quote-attachments/[projectId]/[filename]
    return path.join(
      process.cwd(),
      'uploads',
      'quote-attachments',
      String(projectId),
      attachment.filename
    )
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
  if (quoteData.companyLogo) {
    try {
      const logoPath = path.join(process.cwd(), 'uploads', 'branding', quoteData.companyLogo)
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath)
        const logoExt = path.extname(quoteData.companyLogo).toLowerCase().replace('.', '')

        // Resize logo to reasonable dimensions for PDF (max 600px width for good print quality)
        // This dramatically reduces file size while maintaining visual quality
        let processedLogoBuffer: Buffer
        let imageFormat: 'PNG' | 'JPEG' = 'PNG'

        if (logoExt === 'svg') {
          // SVG logos don't need resizing
          processedLogoBuffer = logoBuffer
        } else {
          // Resize raster images (PNG, JPG) to max 600px width, maintaining aspect ratio
          // Convert to JPEG for better compression (unless it has transparency)
          const metadata = await sharp(logoBuffer).metadata()
          const hasAlpha = metadata.channels === 4

          if (hasAlpha) {
            // Keep PNG for images with transparency, but resize
            processedLogoBuffer = await sharp(logoBuffer)
              .resize(600, 200, { fit: 'inside', withoutEnlargement: true })
              .png({ compressionLevel: 9 })
              .toBuffer()
          } else {
            // Convert to JPEG for smaller size
            processedLogoBuffer = await sharp(logoBuffer)
              .resize(600, 200, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 85 })
              .toBuffer()
            imageFormat = 'JPEG'
          }
        }

        // Get actual dimensions after processing to calculate aspect ratio
        const processedMetadata = await sharp(processedLogoBuffer).metadata()
        const imgWidth = processedMetadata.width || 600
        const imgHeight = processedMetadata.height || 200

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
        const mimeType = imageFormat === 'JPEG' ? 'image/jpeg' :
                         (logoExt === 'svg' ? 'image/svg+xml' : 'image/png')
        const logoData = `data:${mimeType};base64,${logoBase64}`

        // Position logo in top right, above where date will be
        const logoX = pageWidth - 20 - finalWidth
        pdf.addImage(logoData, imageFormat,
          logoX, headerY, finalWidth, finalHeight, undefined, 'SLOW')
        logoActualHeight = finalHeight
      }
    } catch (error) {
      console.error('Error adding company logo to PDF:', error)
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
async function addQuoteItemsTable(
  pdf: jsPDF,
  quoteData: QuoteData,
  startY: number
): Promise<void> {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const marginX = 15 // Reduced from 20mm to maximize width for portrait layout
  const cellPadding = 5
  const cardHeight = 48 // Height for each opening card (reduced from 55mm to fit 3 cards + footer)
  const cardSpacing = 4 // Space between cards (reduced from 6mm)
  const footerHeight = 63 // Space needed for footer with pricing (matches actual footer height)
  const ITEMS_PER_PAGE = 4 // Maximum items per page
  const cardWidth = pageWidth - 2 * marginX
  const cornerRadius = 3 // Rounded corner radius
  const elevationAreaWidth = cardWidth * 0.55 // Width allocated for elevation images (55% of card width)
  const textContentWidth = cardWidth - elevationAreaWidth - cellPadding // Width for text content on left

  const totalItems = quoteData.quoteItems.length
  let currentY = startY
  const totalCardHeight = cardHeight + cardSpacing

  // Calculate how many items can fit on a page based on available space
  const calculateItemsForPage = (
    startYForPage: number,
    includeFooter: boolean
  ): number => {
    const availableHeight = pageHeight - startYForPage - 10 - (includeFooter ? footerHeight : 0)
    return Math.min(Math.floor(availableHeight / totalCardHeight), ITEMS_PER_PAGE)
  }

  // Pre-calculate page assignments for all items
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
      const remainingItems = totalItems - itemIndex

      // Try fitting remaining items + footer
      const itemsWithFooter = calculateItemsForPage(pageStartY, true)

      if (remainingItems <= itemsWithFooter) {
        // All remaining items fit with footer - this is the last page
        pages.push({
          pageItems: Array.from({length: remainingItems}, (_, i) => itemIndex + i),
          includeFooter: true
        })
        break
      } else {
        // Not last page - fit as many as possible without footer, but leave at least 1 for footer page
        const itemsThisPage = calculateItemsForPage(pageStartY, false)
        // Ensure we leave at least 1 item for the next page (which will have the footer)
        const itemsToPlace = Math.max(1, Math.min(itemsThisPage, remainingItems - 1))
        pages.push({
          pageItems: Array.from({length: itemsToPlace}, (_, i) => itemIndex + i),
          includeFooter: false
        })
        itemIndex += itemsToPlace
      }
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

    // Draw card with rounded corners and grey background (no outline)
    pdf.setFillColor(243, 244, 246) // bg-gray-100
    pdf.roundedRect(marginX, currentY, cardWidth, cardHeight, cornerRadius, cornerRadius, 'F')

    // Price badge in top right - hanging off the card edge
    const priceText = `$${item.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    const priceWidth = pdf.getTextWidth(priceText) + 6 // Reduced padding for narrower badge
    const badgeHeight = 8 // Slightly taller for better vertical centering
    const badgeX = marginX + cardWidth - priceWidth + 2 // Hang off right edge by 2mm
    const badgeY = currentY - 3 // Hang off top edge by 3mm

    // Draw price badge background - dark gray
    pdf.setFillColor(51, 51, 51) // #333
    pdf.roundedRect(badgeX, badgeY, priceWidth, badgeHeight, 2, 2, 'F')

    // Draw price text - centered vertically and horizontally
    pdf.setTextColor(255, 255, 255)
    pdf.text(priceText, badgeX + priceWidth / 2, badgeY + badgeHeight / 2 + 1.5, { align: 'center' })
    pdf.setTextColor(0, 0, 0)

    let contentY = currentY + cellPadding + 4

    // Opening name as header (bold, larger font)
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.text(item.name, marginX + cellPadding, contentY)

    // Direction in accent color (bold, dark blue)
    if (item.openingDirections && item.openingDirections.length > 0) {
      const nameWidth = pdf.getTextWidth(item.name)
      pdf.setTextColor(30, 64, 175) // Dark blue accent (#1E40AF)
      pdf.text(` (${item.openingDirections.join(', ')})`, marginX + cellPadding + nameWidth, contentY)
      pdf.setTextColor(0, 0, 0) // Reset to black
    }
    contentY += 5

    // Opening type (description - e.g., "1 Sliding Door") - smaller, normal weight
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(100, 100, 100)
    pdf.text(item.description, marginX + cellPadding, contentY)
    pdf.setTextColor(0, 0, 0)
    contentY += 5

    // Specifications - just dimensions
    pdf.setFontSize(8)
    pdf.text(item.dimensions, marginX + cellPadding, contentY)
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
      const imageAreaY = currentY + 8 // Start below the price badge
      const imageAreaWidth = elevationAreaWidth - cellPadding * 2
      const imageAreaHeight = cardHeight - 10 // Maintain image visibility with smaller card

      // Determine if we have plan view images with metadata
      const usePlanViewImages = item.planViewImages && item.planViewImages.length > 0

      // Calculate how to fit all images
      const numImages = usePlanViewImages ? item.planViewImages!.length : item.elevationImages.length
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
      }
      const preProcessedImages: PreProcessedImage[] = []

      // First pass: Process all images to get their PNG aspect ratios
      for (let imgIndex = 0; imgIndex < numImages; imgIndex++) {
        // Get image data and optional metadata
        const planViewData = usePlanViewImages ? item.planViewImages![imgIndex] : null
        const rawImageData = planViewData ? planViewData.imageData : item.elevationImages[imgIndex]

        try {
          let imageFormat: 'PNG' | 'JPEG' = 'PNG'
          let imageData = rawImageData
          let imageAspectRatio: number | null = null // height / width

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
            if (planViewData?.width && planViewData?.height) {
              imageAspectRatio = planViewData.height / planViewData.width
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
            orientation: planViewData?.orientation,
            apiWidth: planViewData?.width,
            apiHeight: planViewData?.height
          })
        } catch (imageError) {
          console.error(`Failed to process image ${imgIndex}:`, imageError)
        }
      }

      // Second pass: Calculate uniform scale factor and apply scaling
      // For plan views, use API widths and API-based aspect ratios for consistent sizing
      let totalApiWidth = 0
      let maxActualHeight = 0

      if (usePlanViewImages) {
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
      const rawScaleFactor = usePlanViewImages && totalApiWidth > 0 && maxActualHeight > 0
        ? Math.min(imageAreaWidth / totalApiWidth, imageAreaHeight / maxActualHeight)
        : 1
      const uniformScaleFactor = Math.min(rawScaleFactor, 0.7)

      // Apply scaling to create final processed images
      const processedImages: ProcessedImage[] = []

      for (const preImg of preProcessedImages) {
        let scaledWidth: number
        let scaledHeight: number

        // For plan views with API metadata, use uniform scale factor for WIDTH
        // and API-based aspect ratio for HEIGHT for consistent sizing
        if (usePlanViewImages && preImg.apiWidth && preImg.aspectRatio !== null) {
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

  // Determine the correct path based on whether this is a persistent document or project-specific attachment
  let attachmentPath: string
  if (attachment.isPersistent) {
    // Persistent quote documents are stored in /uploads/quote-documents/[docId]/[filename]
    attachmentPath = path.join(
      process.cwd(),
      'public',
      'uploads',
      'quote-documents',
      String(attachment.id),
      attachment.filename
    )
  } else {
    // Project-specific attachments are stored in /uploads/quote-attachments/[projectId]/[filename]
    attachmentPath = path.join(
      process.cwd(),
      'uploads',
      'quote-attachments',
      String(projectId),
      attachment.filename
    )
  }

  if (!fs.existsSync(attachmentPath)) {
    console.error(`Attachment file not found: ${attachmentPath}`)
    pdf.setFontSize(10)
    pdf.setTextColor(150, 150, 150)
    pdf.text('Attachment file not found', pageWidth / 2, pageHeight / 2, { align: 'center' })
    pdf.setTextColor(0, 0, 0)
    return
  }

  // Handle different file types
  if (attachment.mimeType.startsWith('image/')) {
    await addImageAttachment(pdf, attachmentPath, attachment.mimeType, currentY, pageWidth, pageHeight, marginX, marginY)
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
 * Adds an image attachment to the PDF
 */
async function addImageAttachment(
  pdf: jsPDF,
  imagePath: string,
  mimeType: string,
  startY: number,
  pageWidth: number,
  pageHeight: number,
  marginX: number,
  marginY: number
): Promise<void> {
  try {
    // Read image file
    const imageBuffer = fs.readFileSync(imagePath)
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
