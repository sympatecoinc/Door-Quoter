// Quote PDF Generation Utility
// Uses jsPDF to create professional quote PDFs with optional attachments
// Uses pdf-lib to merge PDF attachments

import { jsPDF } from 'jspdf'
import { PDFDocument } from 'pdf-lib'
import fs from 'fs'
import path from 'path'
import { ensurePngDataUrl, isSvgDataUrl } from './svg-to-png'

export interface QuoteItem {
  openingId: number
  name: string
  description: string
  dimensions: string
  color: string
  hardware: string
  hardwarePrice: number
  glassType: string
  costPrice: number
  price: number
  elevationImages: string[]
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
  description?: string | null
}

/**
 * Creates a complete quote PDF with optional attachments
 * Returns a Buffer containing the final PDF (either jsPDF only or merged with PDF attachments)
 */
export async function createQuotePDF(
  quoteData: QuoteData,
  attachments: QuoteAttachment[] = []
): Promise<Buffer> {
  // Create PDF in landscape mode, letter size
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter'
  })

  // Page 1: Quote details with pricing
  await addQuotePage(pdf, quoteData)

  // Separate PDF attachments from image attachments
  const imageAttachments = attachments.filter(a => a.mimeType.startsWith('image/'))
  const pdfAttachments = attachments.filter(a => a.mimeType === 'application/pdf')

  // Add image attachment pages to jsPDF
  if (imageAttachments.length > 0) {
    for (const attachment of imageAttachments) {
      pdf.addPage()
      await addAttachmentPage(pdf, attachment, quoteData.project.id)
    }
  }

  // If no PDF attachments, return jsPDF as buffer directly
  if (pdfAttachments.length === 0) {
    return Buffer.from(pdf.output('arraybuffer'))
  }

  // If there are PDF attachments, merge them using pdf-lib
  try {
    // Convert jsPDF to pdf-lib PDFDocument
    const mainPdfBytes = pdf.output('arraybuffer')
    let finalPdf = await PDFDocument.load(mainPdfBytes)

    // Merge each PDF attachment
    for (const attachment of pdfAttachments) {
      const attachmentPath = resolveAttachmentPath(attachment, quoteData.project.id)

      if (!fs.existsSync(attachmentPath)) {
        console.error(`PDF attachment not found: ${attachmentPath}`)
        // Add a placeholder page for the missing PDF
        const placeholderPdf = new jsPDF({
          orientation: 'landscape',
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
        const pages = await finalPdf.copyPages(placeholderPdfDoc, placeholderPdfDoc.getPageIndices())
        pages.forEach(page => finalPdf.addPage(page))
        continue
      }

      try {
        // Read and merge the PDF attachment
        const attachmentBytes = await fs.promises.readFile(attachmentPath)
        const attachmentPdf = await PDFDocument.load(attachmentBytes)

        // Copy all pages from the attachment to the final PDF
        const pages = await finalPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices())
        pages.forEach(page => finalPdf.addPage(page))
      } catch (error) {
        console.error(`Error loading PDF attachment ${attachmentPath}:`, error)
        // Add error placeholder page
        const errorPdf = new jsPDF({
          orientation: 'landscape',
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
        const pages = await finalPdf.copyPages(errorPdfDoc, errorPdfDoc.getPageIndices())
        pages.forEach(page => finalPdf.addPage(page))
      }
    }

    // Save and return the merged PDF
    const mergedBytes = await finalPdf.save()
    return Buffer.from(mergedBytes)
  } catch (error) {
    console.error('Error merging PDF attachments:', error)
    // Fall back to returning just the jsPDF without attachments
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

  // Header section
  pdf.setFontSize(24)
  pdf.setFont('helvetica', 'bold')
  pdf.text('JOB ESTIMATE', pageWidth / 2, 20, { align: 'center' })

  // Project information
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'normal')
  const projectInfoY = 35

  // Left column
  pdf.setFont('helvetica', 'bold')
  pdf.text('Project:', 20, projectInfoY)
  pdf.setFont('helvetica', 'normal')
  pdf.text(quoteData.project.name, 45, projectInfoY)

  pdf.setFont('helvetica', 'bold')
  pdf.text('Status:', 20, projectInfoY + 7)
  pdf.setFont('helvetica', 'normal')
  pdf.text(quoteData.project.status, 45, projectInfoY + 7)

  // Right column
  pdf.setFont('helvetica', 'bold')
  pdf.text('Date:', pageWidth - 70, projectInfoY)
  pdf.setFont('helvetica', 'normal')
  pdf.text(new Date().toLocaleDateString(), pageWidth - 45, projectInfoY)

  pdf.setFont('helvetica', 'bold')
  pdf.text('Valid Until:', pageWidth - 70, projectInfoY + 7)
  pdf.setFont('helvetica', 'normal')
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 30)
  pdf.text(validUntil.toLocaleDateString(), pageWidth - 45, projectInfoY + 7)

  // Divider line
  pdf.setLineWidth(0.5)
  pdf.setDrawColor(200, 200, 200)
  pdf.line(20, projectInfoY + 13, pageWidth - 20, projectInfoY + 13)

  // Quote items table - now returns the page number where it ended
  const tableStartY = projectInfoY + 20
  await addQuoteItemsTable(pdf, quoteData, tableStartY)

  // Footer with totals - will be added on the last page by addQuoteItemsTable
}

/**
 * Adds the quote items table with elevation images
 * Uses pagination: 3 items per page, with footer on the last page
 */
async function addQuoteItemsTable(
  pdf: jsPDF,
  quoteData: QuoteData,
  startY: number
): Promise<void> {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const marginX = 20
  const cellPadding = 3
  const rowHeight = 45 // Height for rows with images (increased for better door proportions)
  const footerHeight = 60 // Space needed for footer with pricing
  const ITEMS_PER_PAGE = 3 // Maximum items per page

  // Column widths - increased elevation column for better thumbnail visibility
  const colElevation = 60 // Doubled from 30mm to show proper door proportions
  const colOpening = 45 // Reduced from 50mm to accommodate elevation increase
  const colSpecs = 40 // Reduced from 45mm
  const colHardware = 35 // Reduced from 40mm
  const colPrice = pageWidth - 2 * marginX - colElevation - colOpening - colSpecs - colHardware

  const totalItems = quoteData.quoteItems.length
  let currentY = startY
  let itemsOnCurrentPage = 0
  let currentPageIsFirst = true

  // Helper function to add table header
  const addTableHeader = (yPos: number) => {
    pdf.setFillColor(0, 0, 0)
    pdf.rect(marginX, yPos, pageWidth - 2 * marginX, 8, 'F')

    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 255, 255)

    let currentX = marginX
    pdf.text('Elevation', currentX + colElevation / 2, yPos + 5.5, { align: 'center' })
    currentX += colElevation
    pdf.text('Opening', currentX + colOpening / 2, yPos + 5.5, { align: 'center' })
    currentX += colOpening
    pdf.text('Specifications', currentX + colSpecs / 2, yPos + 5.5, { align: 'center' })
    currentX += colSpecs
    pdf.text('Hardware', currentX + colHardware / 2, yPos + 5.5, { align: 'center' })
    currentX += colHardware
    pdf.text('Price', currentX + colPrice / 2, yPos + 5.5, { align: 'center' })

    pdf.setTextColor(0, 0, 0)
    return yPos + 8
  }

  // Add initial table header
  currentY = addTableHeader(currentY)

  // Process each item
  for (let itemIndex = 0; itemIndex < totalItems; itemIndex++) {
    const item = quoteData.quoteItems[itemIndex]
    const isLastItem = itemIndex === totalItems - 1
    const itemsRemaining = totalItems - itemIndex

    // Check if we need a new page
    // On first page: check if we've hit 3 items OR if adding footer would overflow
    // On subsequent pages: check if we've hit 3 items OR if this is last item and footer would overflow
    let needsNewPage = false

    if (itemsOnCurrentPage >= ITEMS_PER_PAGE) {
      // Already have 3 items on this page
      needsNewPage = true
    } else if (isLastItem && currentY + rowHeight + footerHeight > pageHeight - 10) {
      // Last item and footer won't fit on current page
      needsNewPage = true
    } else if (!isLastItem && currentY + rowHeight > pageHeight - 10) {
      // Not last item and row won't fit
      needsNewPage = true
    }

    if (needsNewPage && !currentPageIsFirst) {
      // Add new page and reset header
      pdf.addPage()
      currentY = 20
      currentY = addTableHeader(currentY)
      itemsOnCurrentPage = 0
      currentPageIsFirst = false
    } else if (needsNewPage && currentPageIsFirst) {
      // First page overflow, add new page
      pdf.addPage()
      currentY = 20
      currentY = addTableHeader(currentY)
      itemsOnCurrentPage = 0
      currentPageIsFirst = false
    }

    // Draw row border
    pdf.setDrawColor(200, 200, 200)
    pdf.setLineWidth(0.3)
    pdf.rect(marginX, currentY, pageWidth - 2 * marginX, rowHeight)

    let currentX = marginX

    // Column 1: Elevation thumbnails with aspect-ratio-aware rendering
    if (item.elevationImages && item.elevationImages.length > 0) {
      const availableWidth = colElevation - 2 * cellPadding
      const availableHeight = rowHeight - 2 * cellPadding
      const numPanels = Math.min(item.elevationImages.length, 3)

      // Typical door aspect ratio is tall/narrow (e.g., 80" H x 36" W = 2.22:1)
      // We'll assume a 2.2:1 aspect ratio for doors if we can't detect it
      const assumedAspectRatio = 2.2 // height / width

      // Calculate width per panel based on aspect ratio
      // Each panel should maintain proper proportions
      const panelWidth = Math.min(
        availableWidth / numPanels, // Equal division
        availableHeight / assumedAspectRatio // Width based on available height and aspect ratio
      )
      const panelHeight = Math.min(availableHeight, panelWidth * assumedAspectRatio)

      // Center the group of panels horizontally in the column
      const totalPanelsWidth = panelWidth * numPanels
      const startX = currentX + cellPadding + (availableWidth - totalPanelsWidth) / 2

      for (let i = 0; i < numPanels; i++) {
        try {
          let imgData = item.elevationImages[i]

          // Check if the image data already has a data URI prefix
          if (!imgData.startsWith('data:')) {
            imgData = `data:image/png;base64,${imgData}`
          }

          const imgX = startX + (i * panelWidth)
          const imgY = currentY + cellPadding + (availableHeight - panelHeight) / 2 // Center vertically

          // Convert SVG to PNG at high resolution to preserve details
          // Render at high resolution to ensure SVG details (rails, stiles, glass) remain visible
          const highResWidth = 500 // High resolution for clear detail preservation
          const highResHeight = Math.floor(highResWidth * assumedAspectRatio)
          imgData = await ensurePngDataUrl(imgData, highResWidth, highResHeight)

          // Detect image format from data URI
          let format: 'PNG' | 'JPEG' = 'PNG'
          if (imgData.includes('data:image/jpeg') || imgData.includes('data:image/jpg')) {
            format = 'JPEG'
          }

          pdf.addImage(imgData, format, imgX, imgY, panelWidth - 0.5, panelHeight)
        } catch (error) {
          console.error('Error adding elevation image:', error)
          // Draw a placeholder box instead
          const imgX = startX + (i * panelWidth)
          const imgY = currentY + cellPadding + (availableHeight - panelHeight) / 2
          pdf.setDrawColor(200, 200, 200)
          pdf.rect(imgX, imgY, panelWidth - 0.5, panelHeight)
        }
      }
    }
    currentX += colElevation

    // Vertical separator
    pdf.line(currentX, currentY, currentX, currentY + rowHeight)

    // Column 2: Opening name and description
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    const openingNameLines = pdf.splitTextToSize(item.name, colOpening - 2 * cellPadding)
    pdf.text(openingNameLines, currentX + cellPadding, currentY + cellPadding + 4)

    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    const descLines = pdf.splitTextToSize(item.description, colOpening - 2 * cellPadding)
    pdf.text(descLines, currentX + cellPadding, currentY + cellPadding + 10)
    currentX += colOpening

    // Vertical separator
    pdf.line(currentX, currentY, currentX, currentY + rowHeight)

    // Column 3: Specifications
    pdf.setFontSize(8)
    let specY = currentY + cellPadding + 4

    pdf.setFont('helvetica', 'bold')
    pdf.text('DIMENSIONS', currentX + cellPadding, specY)
    pdf.setFont('helvetica', 'normal')
    pdf.text(item.dimensions, currentX + cellPadding, specY + 4)

    pdf.setFont('helvetica', 'bold')
    pdf.text('COLOR', currentX + cellPadding, specY + 10)
    pdf.setFont('helvetica', 'normal')
    pdf.text(item.color.toUpperCase(), currentX + cellPadding, specY + 14)

    pdf.setFont('helvetica', 'bold')
    pdf.text('GLASS', currentX + cellPadding, specY + 20)
    pdf.setFont('helvetica', 'normal')
    pdf.text(item.glassType.toUpperCase(), currentX + cellPadding, specY + 24)
    currentX += colSpecs

    // Vertical separator
    pdf.line(currentX, currentY, currentX, currentY + rowHeight)

    // Column 4: Hardware
    pdf.setFontSize(8)
    const hardwareText = item.hardware && item.hardware !== 'Standard' ? item.hardware : 'Standard Hardware'
    const hardwareLines = pdf.splitTextToSize(hardwareText, colHardware - 2 * cellPadding)
    pdf.text(hardwareLines, currentX + cellPadding, currentY + cellPadding + 4)
    currentX += colHardware

    // Vertical separator
    pdf.line(currentX, currentY, currentX, currentY + rowHeight)

    // Column 5: Price
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text(`$${item.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
      currentX + colPrice / 2, currentY + rowHeight / 2 + 2, { align: 'center' })

    currentY += rowHeight
    itemsOnCurrentPage++

    // If this is the last item, add the footer on the current page
    if (isLastItem) {
      addQuoteFooter(pdf, quoteData)
    }
  }
}

/**
 * Adds the footer with pricing totals
 */
function addQuoteFooter(pdf: jsPDF, quoteData: QuoteData): void {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const marginX = 20
  const footerY = pageHeight - 60

  // Background for footer
  pdf.setFillColor(248, 248, 248)
  pdf.rect(marginX, footerY, pageWidth - 2 * marginX, 50, 'F')

  // Pricing breakdown on the right side
  const priceX = pageWidth - 80
  let priceY = footerY + 10

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')

  // Subtotal (Openings)
  pdf.text('Subtotal (Openings):', priceX, priceY)
  pdf.text(`$${quoteData.adjustedSubtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
    pageWidth - marginX - 5, priceY, { align: 'right' })
  priceY += 7

  // Installation (always show)
  pdf.text('Installation:', priceX, priceY)
  pdf.text(`$${quoteData.installationCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
    pageWidth - marginX - 5, priceY, { align: 'right' })
  priceY += 7

  // Tax (if applicable)
  if (quoteData.taxRate > 0) {
    pdf.text(`Tax (${(quoteData.taxRate * 100).toFixed(1)}%):`, priceX, priceY)
    pdf.text(`$${quoteData.taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
      pageWidth - marginX - 5, priceY, { align: 'right' })
    priceY += 7
  }

  // Total
  pdf.setLineWidth(0.5)
  pdf.setDrawColor(100, 100, 100)
  pdf.line(priceX, priceY - 2, pageWidth - marginX - 5, priceY - 2)

  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('TOTAL:', priceX, priceY + 5)
  pdf.text(`$${quoteData.totalPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
    pageWidth - marginX - 5, priceY + 5, { align: 'right' })

  // Left side - project info
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'italic')
  pdf.setTextColor(100, 100, 100)
  pdf.text(`This quote includes ${quoteData.quoteItems.length} opening${quoteData.quoteItems.length !== 1 ? 's' : ''}`,
    marginX + 5, footerY + 15)

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
